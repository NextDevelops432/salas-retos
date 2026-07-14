-- ============================================================
-- Retos y recompensas nuevos (o editados) quedan pendientes de
-- aprobación de otro integrante de la sala antes de poder usarse.
-- Si alguien más los edita, vuelven a quedar pendientes, ahora
-- para que el autor original (o cualquiera que no sea quien editó)
-- los apruebe. Si se rechazan, se archivan y se borran solos a
-- los 5 días.
-- ============================================================

alter table tasks   add column if not exists approval_status text not null default 'pending'
  check (approval_status in ('pending', 'approved', 'rejected'));
alter table tasks   add column if not exists last_modified_by uuid references auth.users(id);
alter table tasks   add column if not exists rejected_at timestamptz;

alter table rewards add column if not exists approval_status text not null default 'pending'
  check (approval_status in ('pending', 'approved', 'rejected'));
alter table rewards add column if not exists last_modified_by uuid references auth.users(id);
alter table rewards add column if not exists rejected_at timestamptz;

-- Todo lo que ya existía se considera aprobado (se creó antes de
-- que existiera este flujo).
update tasks   set approval_status = 'approved', last_modified_by = created_by where approval_status = 'pending';
update rewards set approval_status = 'approved', last_modified_by = created_by where approval_status = 'pending';

-- La creación/edición directa ya no va por INSERT/UPDATE normales,
-- sino por las funciones de abajo (que fuerzan approval_status y
-- last_modified_by en servidor, no confiando en lo que mande el cliente).
drop policy if exists "tasks_insert_member" on tasks;
drop policy if exists "tasks_update_creator_or_owner" on tasks;
drop policy if exists "rewards_insert_member" on rewards;
drop policy if exists "rewards_update_creator_or_owner" on rewards;

-- ============================================================
-- RPC: crear reto (queda pendiente de aprobación)
-- ============================================================
create or replace function create_task(
  p_room_id uuid, p_title text, p_description text, p_points int,
  p_due_at timestamptz, p_requires_approval boolean,
  p_is_recurring boolean, p_recurrence_hours int
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  new_task tasks;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not is_room_member(p_room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if length(trim(p_title)) = 0 then
    raise exception 'el título no puede estar vacío';
  end if;
  if p_points is null or p_points <= 0 then
    raise exception 'los puntos deben ser mayores a 0';
  end if;

  insert into tasks (
    room_id, title, description, points, due_at, requires_approval,
    is_recurring, recurrence_hours, created_by, last_modified_by, approval_status
  )
  values (
    p_room_id, trim(p_title), coalesce(p_description, ''), p_points, p_due_at, p_requires_approval,
    p_is_recurring, p_recurrence_hours, auth.uid(), auth.uid(), 'pending'
  )
  returning * into new_task;

  return new_task;
end;
$$;

-- ============================================================
-- RPC: proponer cambios a un reto (vuelve a quedar pendiente)
-- ============================================================
create or replace function propose_task_edit(
  p_task_id uuid, p_title text, p_description text, p_points int,
  p_due_at timestamptz, p_requires_approval boolean,
  p_is_recurring boolean, p_recurrence_hours int
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  the_task tasks;
  updated tasks;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into the_task from tasks where id = p_task_id;
  if not found then
    raise exception 'reto no encontrado';
  end if;
  if not is_room_member(the_task.room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if length(trim(p_title)) = 0 then
    raise exception 'el título no puede estar vacío';
  end if;
  if p_points is null or p_points <= 0 then
    raise exception 'los puntos deben ser mayores a 0';
  end if;

  update tasks
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      points = p_points,
      due_at = p_due_at,
      requires_approval = p_requires_approval,
      is_recurring = p_is_recurring,
      recurrence_hours = p_recurrence_hours,
      last_modified_by = auth.uid(),
      approval_status = 'pending',
      rejected_at = null
  where id = p_task_id
  returning * into updated;

  return updated;
end;
$$;

-- ============================================================
-- RPC: aprobar/rechazar un reto propuesto (no quien lo propuso)
-- ============================================================
create or replace function review_task_approval(p_task_id uuid, p_approve boolean)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  the_task tasks;
  updated tasks;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into the_task from tasks where id = p_task_id;
  if not found then
    raise exception 'reto no encontrado';
  end if;
  if not is_room_member(the_task.room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if the_task.approval_status != 'pending' then
    raise exception 'este reto ya fue revisado';
  end if;
  if the_task.last_modified_by = auth.uid() then
    raise exception 'no puedes aprobar tu propia propuesta';
  end if;

  update tasks
  set approval_status = case when p_approve then 'approved' else 'rejected' end,
      rejected_at = case when p_approve then null else now() end
  where id = p_task_id
  returning * into updated;

  return updated;
end;
$$;

-- ============================================================
-- RPC: crear recompensa (queda pendiente de aprobación)
-- ============================================================
create or replace function create_reward(p_room_id uuid, p_title text, p_description text, p_cost_points int)
returns rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  new_reward rewards;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not is_room_member(p_room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if length(trim(p_title)) = 0 then
    raise exception 'el nombre no puede estar vacío';
  end if;
  if p_cost_points is null or p_cost_points <= 0 then
    raise exception 'el costo debe ser mayor a 0';
  end if;

  insert into rewards (room_id, title, description, cost_points, created_by, last_modified_by, approval_status)
  values (p_room_id, trim(p_title), coalesce(p_description, ''), p_cost_points, auth.uid(), auth.uid(), 'pending')
  returning * into new_reward;

  return new_reward;
end;
$$;

-- ============================================================
-- RPC: proponer cambios a una recompensa (vuelve a quedar pendiente)
-- ============================================================
create or replace function propose_reward_edit(p_reward_id uuid, p_title text, p_description text, p_cost_points int)
returns rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  the_reward rewards;
  updated rewards;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into the_reward from rewards where id = p_reward_id;
  if not found then
    raise exception 'recompensa no encontrada';
  end if;
  if not is_room_member(the_reward.room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if length(trim(p_title)) = 0 then
    raise exception 'el nombre no puede estar vacío';
  end if;
  if p_cost_points is null or p_cost_points <= 0 then
    raise exception 'el costo debe ser mayor a 0';
  end if;

  update rewards
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      cost_points = p_cost_points,
      last_modified_by = auth.uid(),
      approval_status = 'pending',
      rejected_at = null
  where id = p_reward_id
  returning * into updated;

  return updated;
end;
$$;

-- ============================================================
-- RPC: aprobar/rechazar una recompensa propuesta
-- ============================================================
create or replace function review_reward_approval(p_reward_id uuid, p_approve boolean)
returns rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  the_reward rewards;
  updated rewards;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into the_reward from rewards where id = p_reward_id;
  if not found then
    raise exception 'recompensa no encontrada';
  end if;
  if not is_room_member(the_reward.room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if the_reward.approval_status != 'pending' then
    raise exception 'esta recompensa ya fue revisada';
  end if;
  if the_reward.last_modified_by = auth.uid() then
    raise exception 'no puedes aprobar tu propia propuesta';
  end if;

  update rewards
  set approval_status = case when p_approve then 'approved' else 'rejected' end,
      rejected_at = case when p_approve then null else now() end
  where id = p_reward_id
  returning * into updated;

  return updated;
end;
$$;

-- ============================================================
-- No se puede completar un reto ni canjear una recompensa que
-- todavía no está aprobada.
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
  if the_task.approval_status != 'approved' then
    raise exception 'este reto todavía no está aprobado por la sala';
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
    insert into tasks (
      room_id, title, description, points, due_at, requires_approval, is_recurring,
      recurrence_hours, created_by, last_modified_by, approval_status
    )
    values (
      the_task.room_id, the_task.title, the_task.description, the_task.points,
      now() + (the_task.recurrence_hours || ' hours')::interval,
      the_task.requires_approval, true, the_task.recurrence_hours, the_task.created_by,
      the_task.created_by, 'approved'
    );
    update tasks set status = 'archived' where id = the_task.id;
  end if;

  return new_completion;
end;
$$;

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
  if the_reward.approval_status != 'approved' then
    raise exception 'esta recompensa todavía no está aprobada por la sala';
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

  insert into reward_redemptions (reward_id, room_id, user_id, points_spent, status)
  values (the_reward.id, the_reward.room_id, auth.uid(), the_reward.cost_points, 'pending')
  returning * into new_redemption;

  return new_redemption;
end;
$$;

-- ============================================================
-- Limpieza automática: retos/recompensas rechazados hace más de
-- 5 días se borran solos.
-- ============================================================
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-rejected-tasks-rewards',
  '0 3 * * *',
  $$
    delete from tasks where approval_status = 'rejected' and rejected_at < now() - interval '5 days';
    delete from rewards where approval_status = 'rejected' and rejected_at < now() - interval '5 days';
  $$
);
