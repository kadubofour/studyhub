-- Billing fixes from the final review.

-- An ok check now reserves its cost straight away (under the same lock), so parallel requests
-- can't all pass the limit before any of them is charged. A failed AI call gives it back.
create or replace function public.ai_check(p_user uuid, p_cost int) returns text
language plpgsql security definer set search_path = '' as $$
declare
  used int;
begin
  if p_cost is null or p_cost < 0 or p_cost > 10 then
    raise exception 'AI cost must be between 0 and 10' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if (select count(*) from public.ai_requests r where r.user_id = p_user and r.at > now() - interval '60 seconds') >= 10 then
    return 'rate_limited';
  end if;
  if p_cost > 0 then
    if public.is_premium(p_user) then
      select coalesce(sum(c.cost), 0) into used from public.ai_charges c
       where c.user_id = p_user and c.at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
      if used + p_cost > 400 then return 'fair_use'; end if;
    else
      select coalesce(sum(c.cost), 0) into used from public.ai_charges c
       where c.user_id = p_user and c.at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
      if used + p_cost > 10 then return 'daily_limit'; end if;
    end if;
    insert into public.ai_charges (user_id, cost) values (p_user, p_cost);
  end if;
  insert into public.ai_requests (user_id) values (p_user);
  delete from public.ai_requests r where r.user_id = p_user and r.at < now() - interval '1 day';
  return 'ok';
end $$;

-- After a failed AI call: remove the latest reservation of that cost
create function public.ai_release(p_user uuid, p_cost int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.ai_charges c where c.id = (
    select c2.id from public.ai_charges c2 where c2.user_id = p_user and c2.cost = p_cost order by c2.at desc, c2.id desc limit 1
  );
end $$;

-- A reference recorded as failed can still succeed later (the student retries on the same
-- Paystack checkout): upgrade that row once and extend Premium.
create or replace function public.apply_payment(
  p_user uuid, p_reference text, p_product text, p_amount_minor int, p_currency text, p_channel text,
  p_status text, p_months int, p_paid_at timestamptz, p_customer_code text, p_card_brand text, p_card_last4 text
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  fresh boolean;
  until timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1));
  insert into public.payments (user_id, reference, product, amount_minor, currency, channel, status, months, paid_at)
  values (p_user, p_reference, p_product, p_amount_minor, p_currency, p_channel, p_status, p_months, p_paid_at)
  on conflict (reference) do nothing;
  fresh := found;
  if not fresh and p_status = 'success' then
    update public.payments p set
      product = p_product, amount_minor = p_amount_minor, currency = p_currency, channel = p_channel,
      status = 'success', months = p_months, paid_at = p_paid_at
    where p.reference = p_reference and p.user_id = p_user and p.status = 'failed';
    fresh := found;
  end if;
  insert into public.entitlements (user_id) values (p_user) on conflict (user_id) do nothing;
  if fresh and p_status = 'success' and p_months > 0 then
    update public.entitlements e set
      premium_until = greatest(now(), coalesce(e.premium_until, now())) + make_interval(months => p_months),
      customer_code = coalesce(p_customer_code, e.customer_code),
      card_brand = coalesce(p_card_brand, e.card_brand),
      card_last4 = coalesce(p_card_last4, e.card_last4),
      updated_at = now()
    where e.user_id = p_user;
  end if;
  select e.premium_until into until from public.entitlements e where e.user_id = p_user;
  return until;
end $$;

-- A disable event for a subscription other than the current one is old news: ignore it.
-- (Turning renewal off in Settings passes no code and always applies.)
create or replace function public.set_subscription(p_user uuid, p_subscription_code text, p_email_token text, p_auto_renew boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.entitlements (user_id) values (p_user) on conflict (user_id) do nothing;
  if not p_auto_renew and p_subscription_code is not null and exists (
    select 1 from public.entitlements e
     where e.user_id = p_user and e.subscription_code is not null and e.subscription_code <> p_subscription_code
  ) then
    return;
  end if;
  update public.entitlements e set
    subscription_code = coalesce(p_subscription_code, e.subscription_code),
    email_token = coalesce(p_email_token, e.email_token),
    auto_renew = p_auto_renew, updated_at = now()
  where e.user_id = p_user;
end $$;

revoke execute on function public.ai_release(uuid, int) from public, anon, authenticated;
grant execute on function public.ai_release(uuid, int) to service_role;
