create or replace function public.complete_payment_plan_item(_item_id uuid, _paid_by uuid, _paid_at date default current_date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_report_id uuid;
  v_plan_id uuid;
  v_paid_at timestamptz := _paid_at::timestamptz;
begin
  select i.report_id, i.plan_id into v_report_id, v_plan_id
  from public.payment_plan_items i
  join public.payment_plans p on p.id = i.plan_id
  join public.reports r on r.id = i.report_id
  where i.id = _item_id
    and i.paid_at is null
    and p.status = 'published'
    and r.is_published = true
    and r.report_type = 'roi'
    and r.is_paid = false
  for update of i, r;

  if v_report_id is null then
    raise exception 'Queued payout is unavailable or already paid';
  end if;

  update public.reports
  set is_paid = true, paid_at = v_paid_at
  where id = v_report_id and is_paid = false;

  if not found then
    raise exception 'ROI report is unavailable or already paid';
  end if;

  update public.payment_plan_items
  set paid_by = _paid_by, paid_at = v_paid_at
  where id = _item_id and paid_at is null;

  if not found then
    raise exception 'Queued payout was already completed';
  end if;

  if not exists (
    select 1 from public.payment_plan_items
    where plan_id = v_plan_id and paid_at is null
  ) then
    update public.payment_plans set status = 'completed' where id = v_plan_id;
  end if;
end;
$function$;

revoke execute on function public.complete_payment_plan_item(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.complete_payment_plan_item(uuid, uuid, date) to service_role;