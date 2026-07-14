-- ============================================================
-- Salas de Retos: schema inicial
-- Salas (rooms) -> miembros -> tareas con vencimiento -> fotos de
-- evidencia -> aprobación -> puntos -> recompensas canjeables.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)) || '_' || substr(new.id::text, 1, 4)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- ROOMS
-- ============================================================
create table rooms (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  description  text not null default '',
  invite_code  text not null unique,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table room_members (
  id         uuid primary key default uuid_generate_v4(),
  room_id    uuid not null references rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  unique (room_id, user_id)
);

create index idx_room_members_user on room_members(user_id);
create index idx_room_members_room on room_members(room_id);

-- ============================================================
-- TASKS (retos)
-- ============================================================
create table tasks (
  id                uuid primary key default uuid_generate_v4(),
  room_id           uuid not null references rooms(id) on delete cascade,
  title             text not null,
  description       text not null default '',
  points            int not null check (points > 0),
  due_at            timestamptz,
  requires_approval boolean not null default true,
  is_recurring      boolean not null default false,
  recurrence_hours  int check (recurrence_hours is null or recurrence_hours > 0),
  status            text not null default 'active' check (status in ('active', 'archived')),
  created_by        uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index idx_tasks_room on tasks(room_id, status);

-- ============================================================
-- TASK COMPLETIONS (evidencia + aprobación)
-- ============================================================
create table task_completions (
  id             uuid primary key default uuid_generate_v4(),
  task_id        uuid not null references tasks(id) on delete cascade,
  room_id        uuid not null references rooms(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  photo_url      text,
  note           text,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points_awarded int not null default 0,
  completed_at   timestamptz not null default now(),
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  review_note    text
);

create index idx_completions_room on task_completions(room_id, status);
create index idx_completions_user on task_completions(user_id);
create index idx_completions_task on task_completions(task_id);

-- ============================================================
-- REWARDS (recompensas)
-- ============================================================
create table rewards (
  id           uuid primary key default uuid_generate_v4(),
  room_id      uuid not null references rooms(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  cost_points  int not null check (cost_points > 0),
  is_active    boolean not null default true,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index idx_rewards_room on rewards(room_id, is_active);

-- ============================================================
-- REWARD REDEMPTIONS (canjes)
-- ============================================================
create table reward_redemptions (
  id            uuid primary key default uuid_generate_v4(),
  reward_id     uuid not null references rewards(id) on delete cascade,
  room_id       uuid not null references rooms(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  points_spent  int not null check (points_spent > 0),
  status        text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  redeemed_at   timestamptz not null default now(),
  fulfilled_by  uuid references auth.users(id),
  fulfilled_at  timestamptz
);

create index idx_redemptions_room on reward_redemptions(room_id, status);
create index idx_redemptions_user on reward_redemptions(user_id);

-- ============================================================
-- PUNTOS: vista calculada (aprobados - gastados), nunca un
-- contador mutable, para que no se pueda hacer trampa ni
-- desincronizar.
-- ============================================================
create view room_member_points as
select
  rm.room_id,
  rm.user_id,
  coalesce(earned.total, 0) - coalesce(spent.total, 0) as points_balance,
  coalesce(earned.total, 0) as points_earned,
  coalesce(spent.total, 0) as points_spent
from room_members rm
left join (
  select room_id, user_id, sum(points_awarded) as total
  from task_completions
  where status = 'approved'
  group by room_id, user_id
) earned on earned.room_id = rm.room_id and earned.user_id = rm.user_id
left join (
  select room_id, user_id, sum(points_spent) as total
  from reward_redemptions
  where status != 'cancelled'
  group by room_id, user_id
) spent on spent.room_id = rm.room_id and spent.user_id = rm.user_id;

-- ============================================================
-- HELPER: ¿el usuario actual es miembro de la sala?
-- ============================================================
create or replace function is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from room_members
    where room_id = target_room_id and user_id = auth.uid()
  );
$$;

create or replace function is_room_owner(target_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from room_members
    where room_id = target_room_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ============================================================
-- RPC: crear sala (genera código de invitación y añade al owner)
-- ============================================================
create or replace function create_room(room_name text, room_description text default '')
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  new_room rooms;
  code text;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if length(trim(room_name)) = 0 then
    raise exception 'el nombre de la sala no puede estar vacío';
  end if;

  loop
    code := upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from rooms where invite_code = code);
  end loop;

  insert into rooms (name, description, invite_code, owner_id)
  values (trim(room_name), coalesce(room_description, ''), code, auth.uid())
  returning * into new_room;

  insert into room_members (room_id, user_id, role)
  values (new_room.id, auth.uid(), 'owner');

  return new_room;
end;
$$;

-- ============================================================
-- RPC: unirse a una sala por código de invitación
-- ============================================================
create or replace function join_room(code text)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room rooms;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into target_room from rooms where invite_code = upper(trim(code));
  if not found then
    raise exception 'código de invitación inválido';
  end if;

  insert into room_members (room_id, user_id, role)
  values (target_room.id, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;

  return target_room;
end;
$$;

-- ============================================================
-- RPC: marcar tarea como hecha (con foto opcional)
-- ============================================================
create or replace function complete_task(p_task_id uuid, p_photo_url text default null, p_note text default null)
returns task_completions
language plpgsql
security definer
set search_path = public
as $$
declare
  the_task tasks;
  new_completion task_completions;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into the_task from tasks where id = p_task_id;
  if not found then
    raise exception 'tarea no encontrada';
  end if;
  if not is_room_member(the_task.room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if the_task.status != 'active' then
    raise exception 'esta tarea ya no está activa';
  end if;
  if the_task.due_at is not null and the_task.due_at < now() then
    raise exception 'esta tarea ya venció';
  end if;

  insert into task_completions (task_id, room_id, user_id, photo_url, note, status, points_awarded, reviewed_at)
  values (
    the_task.id,
    the_task.room_id,
    auth.uid(),
    p_photo_url,
    p_note,
    case when the_task.requires_approval then 'pending' else 'approved' end,
    case when the_task.requires_approval then 0 else the_task.points end,
    case when the_task.requires_approval then null else now() end
  )
  returning * into new_completion;

  if the_task.is_recurring and the_task.recurrence_hours is not null then
    insert into tasks (room_id, title, description, points, due_at, requires_approval, is_recurring, recurrence_hours, created_by)
    values (
      the_task.room_id, the_task.title, the_task.description, the_task.points,
      now() + (the_task.recurrence_hours || ' hours')::interval,
      the_task.requires_approval, true, the_task.recurrence_hours, the_task.created_by
    );
    update tasks set status = 'archived' where id = the_task.id;
  end if;

  return new_completion;
end;
$$;

-- ============================================================
-- RPC: aprobar o rechazar una evidencia (otorga los puntos)
-- ============================================================
create or replace function review_completion(p_completion_id uuid, p_approve boolean, p_review_note text default null)
returns task_completions
language plpgsql
security definer
set search_path = public
as $$
declare
  the_completion task_completions;
  the_task tasks;
  updated task_completions;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into the_completion from task_completions where id = p_completion_id;
  if not found then
    raise exception 'evidencia no encontrada';
  end if;
  if the_completion.status != 'pending' then
    raise exception 'esta evidencia ya fue revisada';
  end if;

  select * into the_task from tasks where id = the_completion.task_id;

  if not (is_room_owner(the_completion.room_id) or the_task.created_by = auth.uid()) then
    raise exception 'no tienes permiso para revisar esta evidencia';
  end if;

  update task_completions
  set status = case when p_approve then 'approved' else 'rejected' end,
      points_awarded = case when p_approve then the_task.points else 0 end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note
  where id = p_completion_id
  returning * into updated;

  return updated;
end;
$$;

-- ============================================================
-- RPC: canjear una recompensa (valida saldo de puntos)
-- ============================================================
create or replace function redeem_reward(p_reward_id uuid)
returns reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  the_reward rewards;
  balance int;
  new_redemption reward_redemptions;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into the_reward from rewards where id = p_reward_id;
  if not found or not the_reward.is_active then
    raise exception 'recompensa no disponible';
  end if;
  if not is_room_member(the_reward.room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;

  select coalesce(points_balance, 0) into balance
  from room_member_points
  where room_id = the_reward.room_id and user_id = auth.uid();

  if coalesce(balance, 0) < the_reward.cost_points then
    raise exception 'no tienes suficientes puntos';
  end if;

  insert into reward_redemptions (reward_id, room_id, user_id, points_spent)
  values (the_reward.id, the_reward.room_id, auth.uid(), the_reward.cost_points)
  returning * into new_redemption;

  return new_redemption;
end;
$$;

-- ============================================================
-- RPC: marcar un canje como entregado
-- ============================================================
create or replace function fulfill_redemption(p_redemption_id uuid)
returns reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  the_redemption reward_redemptions;
  the_reward rewards;
  updated reward_redemptions;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into the_redemption from reward_redemptions where id = p_redemption_id;
  if not found then
    raise exception 'canje no encontrado';
  end if;
  if the_redemption.status != 'pending' then
    raise exception 'este canje ya fue procesado';
  end if;

  select * into the_reward from rewards where id = the_redemption.reward_id;

  if not (is_room_owner(the_redemption.room_id) or the_reward.created_by = auth.uid()) then
    raise exception 'no tienes permiso para entregar este canje';
  end if;

  update reward_redemptions
  set status = 'fulfilled', fulfilled_by = auth.uid(), fulfilled_at = now()
  where id = p_redemption_id
  returning * into updated;

  return updated;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles           enable row level security;
alter table rooms              enable row level security;
alter table room_members       enable row level security;
alter table tasks              enable row level security;
alter table task_completions   enable row level security;
alter table rewards            enable row level security;
alter table reward_redemptions enable row level security;

-- Profiles: lectura pública (solo autenticados), edición propia
create policy "profiles_read_all" on profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- Rooms: solo miembros pueden leer. Insert/update solo vía RPC / owner.
create policy "rooms_read_member" on rooms
  for select using (is_room_member(id));

create policy "rooms_update_owner" on rooms
  for update using (owner_id = auth.uid());

-- Room members: visibles para miembros de la misma sala
create policy "room_members_read_member" on room_members
  for select using (is_room_member(room_id));

-- Tasks: miembros leen; miembros crean sus propias tareas; el creador
-- o el owner de la sala puede editar/archivar.
create policy "tasks_read_member" on tasks
  for select using (is_room_member(room_id));

create policy "tasks_insert_member" on tasks
  for insert with check (is_room_member(room_id) and created_by = auth.uid());

create policy "tasks_update_creator_or_owner" on tasks
  for update using (is_room_member(room_id) and (created_by = auth.uid() or is_room_owner(room_id)));

-- Task completions: miembros de la sala leen (para ver evidencia y
-- aprobar). Insert/update van solo por RPC (complete_task / review_completion).
create policy "completions_read_member" on task_completions
  for select using (is_room_member(room_id));

-- Rewards: igual patrón que tasks
create policy "rewards_read_member" on rewards
  for select using (is_room_member(room_id));

create policy "rewards_insert_member" on rewards
  for insert with check (is_room_member(room_id) and created_by = auth.uid());

create policy "rewards_update_creator_or_owner" on rewards
  for update using (is_room_member(room_id) and (created_by = auth.uid() or is_room_owner(room_id)));

-- Reward redemptions: miembros leen; insert/update solo por RPC.
create policy "redemptions_read_member" on reward_redemptions
  for select using (is_room_member(room_id));

-- ============================================================
-- STORAGE: bucket para fotos de evidencia
-- ============================================================
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

-- Ruta esperada: {room_id}/{archivo}. Solo miembros de esa sala
-- pueden subir/leer/borrar sus propias fotos dentro de la carpeta de la sala.
create policy "task_photos_read_member" on storage.objects
  for select using (
    bucket_id = 'task-photos'
    and is_room_member((storage.foldername(name))[1]::uuid)
  );

create policy "task_photos_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'task-photos'
    and is_room_member((storage.foldername(name))[1]::uuid)
  );

create policy "task_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'task-photos'
    and owner = auth.uid()
  );
