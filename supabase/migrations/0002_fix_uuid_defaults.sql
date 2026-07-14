-- ============================================================
-- Fix: uuid_generate_v4() vive en el schema "extensions", pero las
-- funciones SECURITY DEFINER fijan search_path = public, así que no
-- la encuentran ("function uuid_generate_v4() does not exist").
-- gen_random_uuid() es nativa de Postgres (pg_catalog), no depende
-- de ningún schema extra.
-- ============================================================

alter table rooms              alter column id set default gen_random_uuid();
alter table room_members       alter column id set default gen_random_uuid();
alter table tasks              alter column id set default gen_random_uuid();
alter table task_completions   alter column id set default gen_random_uuid();
alter table rewards            alter column id set default gen_random_uuid();
alter table reward_redemptions alter column id set default gen_random_uuid();

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
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
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
