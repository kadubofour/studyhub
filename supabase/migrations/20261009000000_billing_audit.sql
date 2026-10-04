-- Billing fixes from the post-merge audit.

-- A payment held for checking may be for no product we sell; record it as unknown, not as a month
alter table public.payments alter column product drop not null;

-- A partial refund (from the Paystack dashboard) takes back only that share of the time.
-- With no amount, or the full amount, all of it comes off, never into the past.
drop function public.apply_refund(text);
create function public.apply_refund(p_reference text, p_amount_minor int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments%rowtype;
  share numeric;
begin
  select * into p from public.payments where reference = p_reference for update;
  if not found or p.status <> 'success' then return; end if;
  share := least(1, coalesce(p_amount_minor::numeric / nullif(p.amount_minor, 0), 1));
  update public.payments set status = 'refunded' where id = p.id;
  update public.entitlements e set
    premium_until = greatest(now(), e.premium_until - make_interval(months => p.months) * share), updated_at = now()
  where e.user_id = p.user_id and e.premium_until is not null;
end $$;

revoke execute on function public.apply_refund(text, int) from public, anon, authenticated;
grant execute on function public.apply_refund(text, int) to service_role;
