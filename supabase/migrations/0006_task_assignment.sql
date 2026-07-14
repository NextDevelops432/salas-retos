-- ============================================================
-- Los retos ahora se asignan a otra persona de la sala (no te
-- los puedes asignar a ti mismo). Como quien crea el reto ya
-- eligió a quién dárselo, ya no hace falta que nadie apruebe la
-- creación — solo se necesita aprobación si alguien más (no el
-- asignado) edita el reto después. Solo el asignado puede
-- marcarlo como hecho.
-- ============================================================

alter table tasks add column if not exists assigned_to uuid references auth.users(id);

create or replace function create_task(
  p_room_id uuid, p_title text, p_description text, p_points int,
  p_due_at timestamptz, p_requires_approval boolean,
  p_is_recurring boolean, p_recurrence_hours int, p_icon text default null,
  p_assigned_to uuid default null
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
  if p_assigned_to is null then
    raise exception 'elige a quién le asignas este reto';
  end if;
  if p_assigned_to = auth.uid() then
    raise exception 'no puedes asignarte un reto a ti mismo';
  end if;
  if not exists (select 1 from room_members where room_id = p_room_id and user_id = p_assigned_to) then
    raise exception 'esa persona no es miembro de la sala';
  end if;

  insert into tasks (
    room_id, title, description, points, due_at, requires_approval,
    is_recurring, recurrence_hours, icon, assigned_to, created_by, last_modified_by, approval_status
  )
  values (
    p_room_id, trim(p_title), coalesce(p_description, ''), p_points, p_due_at, p_requires_approval,
    p_is_recurring, p_recurrence_hours, nullif(trim(coalesce(p_icon, '')), ''), p_assigned_to,
    auth.uid(), auth.uid(), 'approved'
  )
  returning * into new_task;

  return new_task;
end;
$$;

create or replace function propose_task_edit(
  p_task_id uuid, p_title text, p_description text, p_points int,
  p_due_at timestamptz, p_requires_approval boolean,
  p_is_recurring boolean, p_recurrence_hours int, p_icon text default null,
  p_assigned_to uuid default null
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  the_task tasks;
  updated tasks;
  new_assignee uuid;
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

  new_assignee := coalesce(p_assigned_to, the_task.assigned_to);
  if new_assignee is null then
    raise exception 'elige a quién le asignas este reto';
  end if;
  if new_assignee = auth.uid() then
    raise exception 'no puedes asignarte un reto a ti mismo';
  end if;
  if not exists (select 1 from room_members where room_id = the_task.room_id and user_id = new_assignee) then
    raise exception 'esa persona no es miembro de la sala';
  end if;

  update tasks
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      points = p_points,
      due_at = p_due_at,
      requires_approval = p_requires_approval,
      is_recurring = p_is_recurring,
      recurrence_hours = p_recurrence_hours,
      icon = nullif(trim(coalesce(p_icon, '')), ''),
      assigned_to = new_assignee,
      last_modified_by = auth.uid(),
      approval_status = case when auth.uid() = new_assignee then 'approved' else 'pending' end,
      rejected_at = null
  where id = p_task_id
  returning * into updated;

  return updated;
end;
$$;

-- Solo la persona asignada puede aprobar/rechazar cambios a su reto.
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
  if the_task.approval_status != 'pending' then
    raise exception 'este reto ya fue revisado';
  end if;
  if the_task.assigned_to != auth.uid() then
    raise exception 'solo la persona asignada puede aprobar este reto';
  end if;

  update tasks
  set approval_status = case when p_approve then 'approved' else 'rejected' end,
      rejected_at = case when p_approve then null else now() end
  where id = p_task_id
  returning * into updated;

  return updated;
end;
$$;

-- Solo la persona asignada puede marcar el reto como hecho (los retos
-- viejos sin asignar siguen abiertos a cualquier integrante).
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
  if the_task.assigned_to is not null and the_task.assigned_to != auth.uid() then
    raise exception 'este reto está asignado a otra persona';
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
      recurrence_hours, icon, assigned_to, created_by, last_modified_by, approval_status
    )
    values (
      the_task.room_id, the_task.title, the_task.description, the_task.points,
      now() + (the_task.recurrence_hours || ' hours')::interval,
      the_task.requires_approval, true, the_task.recurrence_hours, the_task.icon, the_task.assigned_to,
      the_task.created_by, the_task.created_by, 'approved'
    );
    update tasks set status = 'archived' where id = the_task.id;
  end if;

  return new_completion;
end;
$$;
