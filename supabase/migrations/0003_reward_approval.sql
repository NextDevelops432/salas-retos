-- ============================================================
-- Canjes de recompensas: ahora requieren aprobación de otro
-- integrante de la sala (no el owner en exclusiva) antes de
-- descontar los puntos. Reemplaza el flujo anterior de
-- "marcar como entregado".
-- ============================================================

-- Migrar filas existentes antes de cambiar el check constraint
update reward_redemptions set status = 'approved' where status = 'fulfilled';
update reward_redemptions set status = 'rejected' where status = 'cancelled';

alter table reward_redemptions drop constraint if exists reward_redemptions_status_check;
alter table reward_redemptions add constraint reward_redemptions_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table reward_redemptions rename column fulfilled_by to reviewed_by;
alter table reward_redemptions rename column fulfilled_at to reviewed_at;
alter table reward_redemptions add column if not exists review_note text;

-- Los puntos gastados solo cuentan una vez aprobado el canje.
create or replace view room_member_points as
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
  where status = 'approved'
  group by room_id, user_id
) spent on spent.room_id = rm.room_id and spent.user_id = rm.user_id;

drop function if exists fulfill_redemption(uuid);

-- redeem_reward: crea la solicitud en estado 'pending'. Los puntos
-- no se descuentan hasta que otro integrante la apruebe.
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

  insert into reward_redemptions (reward_id, room_id, user_id, points_spent, status)
  values (the_reward.id, the_reward.room_id, auth.uid(), the_reward.cost_points, 'pending')
  returning * into new_redemption;

  return new_redemption;
end;
$$;

-- review_redemption: cualquier integrante de la sala, excepto quien
-- pidió el canje, puede aprobarlo o rechazarlo. Al aprobar se
-- revalida el saldo (por si hay varias solicitudes pendientes a la vez).
create or replace function review_redemption(p_redemption_id uuid, p_approve boolean, p_review_note text default null)
returns reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  the_redemption reward_redemptions;
  balance int;
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
  if not is_room_member(the_redemption.room_id) then
    raise exception 'no eres miembro de esta sala';
  end if;
  if the_redemption.user_id = auth.uid() then
    raise exception 'no puedes aprobar tu propio canje';
  end if;

  if p_approve then
    select coalesce(points_balance, 0) into balance
    from room_member_points
    where room_id = the_redemption.room_id and user_id = the_redemption.user_id;

    if coalesce(balance, 0) < the_redemption.points_spent then
      raise exception 'el solicitante ya no tiene suficientes puntos';
    end if;
  end if;

  update reward_redemptions
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note
  where id = p_redemption_id
  returning * into updated;

  return updated;
end;
$$;
