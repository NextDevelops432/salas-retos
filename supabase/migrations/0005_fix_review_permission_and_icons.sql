-- ============================================================
-- Fix: review_completion solo dejaba aprobar al dueno de la sala
-- o a quien creo la tarea. Si alguien creaba Y completaba su
-- propia tarea, nadie mas podia aprobarla. Ahora, igual que con
-- canjes y propuestas, cualquier integrante de la sala que NO
-- sea quien mando la evidencia puede aprobarla o rechazarla.
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
  if not is_room_member(the_completion.room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if the_completion.user_id = auth.uid() then
    raise exception 'no puedes aprobar tu propia evidencia';
  end if;

  select * into the_task from tasks where id = the_completion.task_id;

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
-- Icono personalizado (emoji) elegido por el usuario al crear un
-- reto o recompensa. Si es NULL, la app usa un emoji automatico
-- segun el titulo.
-- ============================================================
alter table tasks   add column if not exists icon text;
alter table rewards add column if not exists icon text;

create or replace function create_task(
  p_room_id uuid, p_title text, p_description text, p_points int,
  p_due_at timestamptz, p_requires_approval boolean,
  p_is_recurring boolean, p_recurrence_hours int, p_icon text default null
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
    is_recurring, recurrence_hours, icon, created_by, last_modified_by, approval_status
  )
  values (
    p_room_id, trim(p_title), coalesce(p_description, ''), p_points, p_due_at, p_requires_approval,
    p_is_recurring, p_recurrence_hours, nullif(trim(coalesce(p_icon, '')), ''), auth.uid(), auth.uid(), 'pending'
  )
  returning * into new_task;

  return new_task;
end;
$$;

create or replace function propose_task_edit(
  p_task_id uuid, p_title text, p_description text, p_points int,
  p_due_at timestamptz, p_requires_approval boolean,
  p_is_recurring boolean, p_recurrence_hours int, p_icon text default null
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
      icon = nullif(trim(coalesce(p_icon, '')), ''),
      last_modified_by = auth.uid(),
      approval_status = 'pending',
      rejected_at = null
  where id = p_task_id
  returning * into updated;

  return updated;
end;
$$;

create or replace function create_reward(p_room_id uuid, p_title text, p_description text, p_cost_points int, p_icon text default null)
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

  insert into rewards (room_id, title, description, cost_points, icon, created_by, last_modified_by, approval_status)
  values (p_room_id, trim(p_title), coalesce(p_description, ''), p_cost_points, nullif(trim(coalesce(p_icon, '')), ''), auth.uid(), auth.uid(), 'pending')
  returning * into new_reward;

  return new_reward;
end;
$$;

create or replace function propose_reward_edit(p_reward_id uuid, p_title text, p_description text, p_cost_points int, p_icon text default null)
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
      icon = nullif(trim(coalesce(p_icon, '')), ''),
      last_modified_by = auth.uid(),
      approval_status = 'pending',
      rejected_at = null
  where id = p_reward_id
  returning * into updated;

  return updated;
end;
$$;
