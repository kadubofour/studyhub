-- Billing: Free (10 AI actions a day) and Premium (fair use 400 a month), paid through Paystack.
-- Only the server (service role) writes plans, payments and usage; students can read their own.

create table public.entitlements (
  user_id uuid primary key references auth.users on delete cascade,
  premium_until timestamptz,
  auto_renew boolean not null default false,
  provider text not null default 'paystack',
  customer_code text, subscription_code text, email_token text,
  card_brand text, card_last4 text,
  updated_at timestamptz not null default now()
);
create unique index entitlements_customer on public.entitlements (customer_code) where customer_code is not null;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null default 'paystack',
  reference text not null unique,
  product text not null check (product in ('pass_1m','pass_3m','pass_12m','renew_1m','renew_12m')),
  amount_minor int not null check (amount_minor >= 0),
  currency text not null,
  channel text not null check (channel in ('mobile_money','card','other')),
  status text not null check (status in ('success','failed','refunded','needs_review')),
  months int not null check (months between 0 and 12),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_user on public.payments (user_id, created_at desc);

create table public.billing_events (
  id text primary key,
  provider text not null,
  type text not null,
  received_at timestamptz not null default now()
);

create table public.ai_charges (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  cost int not null check (cost between 1 and 10),
  at timestamptz not null default now()
);
create index ai_charges_user_at on public.ai_charges (user_id, at);

alter table public.entitlements enable row level security;
create policy "read own plan" on public.entitlements for select using (user_id = (select auth.uid()));
alter table public.payments enable row level security;
create policy "read own payments" on public.payments for select using (user_id = (select auth.uid()));
alter table public.billing_events enable row level security;  -- no policies: server only
alter table public.ai_charges enable row level security;
create policy "read own charges" on public.ai_charges for select using (user_id = (select auth.uid()));

-- The student-callable speed-limit check from Phase 2 is replaced by ai_check (server only)
drop function public.ai_request_allowed();

create function public.is_premium(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.premium_until > now() from public.entitlements e where e.user_id = p_user), false)
$$;

-- Before an AI call: the speed limit for everyone, then the plan's limit for this cost.
create function public.ai_check(p_user uuid, p_cost int) returns text
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
  end if;
  insert into public.ai_requests (user_id) values (p_user);
  delete from public.ai_requests r where r.user_id = p_user and r.at < now() - interval '1 day';
  return 'ok';
end $$;

-- After a successful AI call
create function public.ai_charge(p_user uuid, p_cost int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_cost is null or p_cost < 0 or p_cost > 10 then
    raise exception 'AI cost must be between 0 and 10' using errcode = '22023';
  end if;
  if p_cost > 0 then insert into public.ai_charges (user_id, cost) values (p_user, p_cost); end if;
end $$;

-- Record a verified payment once (by reference); extend Premium only for a new successful one.
create function public.apply_payment(
  p_user uuid, p_reference text, p_product text, p_amount_minor int, p_currency text, p_channel text,
  p_status text, p_months int, p_paid_at timestamptz, p_customer_code text, p_card_brand text, p_card_last4 text
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  inserted boolean;
  until timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1));
  insert into public.payments (user_id, reference, product, amount_minor, currency, channel, status, months, paid_at)
  values (p_user, p_reference, p_product, p_amount_minor, p_currency, p_channel, p_status, p_months, p_paid_at)
  on conflict (reference) do nothing;
  inserted := found;
  insert into public.entitlements (user_id) values (p_user) on conflict (user_id) do nothing;
  if inserted and p_status = 'success' and p_months > 0 then
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

create function public.set_subscription(p_user uuid, p_subscription_code text, p_email_token text, p_auto_renew boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.entitlements (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.entitlements e set
    subscription_code = coalesce(p_subscription_code, e.subscription_code),
    email_token = coalesce(p_email_token, e.email_token),
    auto_renew = p_auto_renew, updated_at = now()
  where e.user_id = p_user;
end $$;

-- A refund (done in the Paystack dashboard) takes that payment's months back off, never into the past
create function public.apply_refund(p_reference text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments%rowtype;
begin
  select * into p from public.payments where reference = p_reference for update;
  if not found or p.status <> 'success' then return; end if;
  update public.payments set status = 'refunded' where id = p.id;
  update public.entitlements e set
    premium_until = greatest(now(), e.premium_until - make_interval(months => p.months)), updated_at = now()
  where e.user_id = p.user_id and e.premium_until is not null;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'is_premium(uuid)', 'ai_check(uuid, int)', 'ai_charge(uuid, int)',
    'apply_payment(uuid, text, text, int, text, text, text, int, timestamptz, text, text, text)',
    'set_subscription(uuid, text, text, boolean)', 'apply_refund(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
