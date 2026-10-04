# Billing — Free and Premium plans (Paystack) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Free plan (10 AI actions a day) and a paid Premium plan (unlimited AI with fair use) that students in Ghana buy through Paystack with MoMo or card, as passes or card auto-renew.

**Architecture:** Usage and entitlements are written only by the server with the Supabase service role key, through `security definer` SQL functions that students can't call. `runAiAction` asks `ai_check` before every AI call and `ai_charge` after success. Paystack checkout is started by our server; payments are credited only after our server verifies them with Paystack (from the webhook, or from the return page), idempotently by reference.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + RLS), Paystack REST API (via `fetch`), Node `crypto` (HMAC-SHA512), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-billing-premium-design.md`

## Global Constraints

- Free: **10 AI actions per UTC day**; PDF import costs **1 per 10 pages (rounded up, 1–10)**; summary, flashcards, quiz = 1; quiz marking = 0 (free, still speed-limited).
- Premium: unlimited with fair use **400 AI actions per UTC calendar month**. (The spec's 20 h/month transcript fair use belongs to accurate transcripts, which ship in Phase 2 Plan C; this plan only defines the constant.)
- Everyone: speed limit **10 AI requests per minute**.
- Prices in **GHS, amounts in pesewas**: 1 month **5000** (GHS 50), 3 months **13500** (GHS 135), 1 year **48000** (GHS 480). Auto-renew only for 1 month and 1 year, **card only**; passes allow `card` and `mobile_money`.
- Buying while Premium adds time: `premium_until = greatest(now(), premium_until) + months`.
- Only the server writes `entitlements`, `payments`, `billing_events`, `ai_requests`, `ai_charges` (service role, `lib/supabase/admin.ts`, `import 'server-only'`). Students may `select` their own rows except `billing_events`.
- Billing env (server-only): `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_MONTHLY`, `PAYSTACK_PLAN_YEARLY`, `SUPABASE_SERVICE_ROLE_KEY`; optional `PAYSTACK_BASE_URL` (default `https://api.paystack.co`, overridden only by E2E). Without `PAYSTACK_SECRET_KEY` the billing UI is hidden and everyone is on Free.
- **Paystack field-name assumptions** (their docs block automated access; confirm in the Paystack test dashboard before going live — see "After this plan"): initialize `POST /transaction/initialize` `{ email, amount, currency, callback_url, channels, metadata, plan }` → `data.{authorization_url, reference}`; verify `GET /transaction/verify/:reference` → `data.{status, reference, amount, currency, channel, paid_at, metadata, customer.customer_code, authorization.{last4, brand}, plan}` (`plan` may be null, a code string, or `{ plan_code }`; `metadata` may be an object or a JSON string); webhook header `x-paystack-signature` = hex HMAC-SHA512 of the raw body keyed with the secret key; events `charge.success`, `subscription.create` / `.disable` / `.not_renew` (`data.subscription_code`, `data.email_token`, `data.customer.customer_code`, `data.plan.plan_code`), `refund.processed` (`data.transaction_reference` or `data.transaction.reference`); disable `POST /subscription/disable` `{ code, token }`. All parsing lives in `lib/billing/paystack.ts` so a mismatch is fixed in one file.
- TDD for every change; commit after each task with trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Write files with backslashes/escapes using the editor tools, not shell heredocs.
- E2E runs its own dev server on port 3100 (stop other `next dev` runs in this folder first).

## Review Focus

1. **A payment confirmed twice (webhook and return page racing, or Paystack retrying)** — Premium must be extended exactly once. (DB test Task 1; route tests Tasks 8–9.)
2. **A forged or tampered webhook / a reference that isn't the student's** — nothing is credited; the return page refuses another student's reference. (Tests Tasks 8–9.)
3. **Premium expiring mid-month** — the student is back on the free daily limit immediately, counting only today's usage. (DB test Task 1.)
4. **The free limit reached in the middle of using AI** — the student sees "You've used today's 10 free AI actions … Get Premium", not a generic error, in every place AI is used. (Tests Tasks 4–5.)
5. **MoMo payment still pending when the student returns** — the return page doesn't claim failure; it says Premium will switch on when Paystack confirms. (Tests Tasks 9, 11.)

---

## File structure

```
supabase/migrations/20261007000000_billing.sql   entitlements, payments, billing_events, ai_charges, ai_check, ai_charge, apply_payment, set_subscription, apply_refund
lib/supabase/admin.ts           service-role client (server-only)
lib/billing/plans.ts            limits, products, prices, formatGhs (client-safe)
lib/billing/paystack.ts         Paystack HTTP + signature + response parsing
lib/billing/credit.ts           creditVerifiedCharge: verified charge → apply_payment
app/api/billing/checkout/route.ts
app/api/billing/webhook/route.ts
app/api/billing/confirm/route.ts
app/api/billing/cancel-renewal/route.ts
app/api/test-paystack/[...path]/route.ts     E2E-only fake Paystack (API + a fake pay page)
lib/billing/fakePaystackStore.ts             E2E-only in-memory store
components/billing/usePlan.ts                client hook: plan + today's/month's usage
components/billing/LimitPrompt.tsx           "You've used today's 10 free AI actions…"
components/billing/PremiumBadge.tsx          ✦ Premium in the sidebar
components/billing/EndingBanner.tsx          "Premium ends on … · Renew"
components/ai/AiError.tsx                    shows LimitPrompt or a plain alert for an AI error
components/settings/PlanCard.tsx             Settings → Plan
app/(app)/plans/page.tsx                     choose a plan
app/(app)/plans/return/page.tsx              after Paystack
```

---

### Task 1: Billing tables and server-only usage functions

**Files:**
- Create: `supabase/migrations/20261007000000_billing.sql`, `tests/db/billing.test.ts`
- Modify: `tests/db/helpers.ts` (add `adminClient`), `tests/db/aiSpeedLimit.test.ts` (old RPC replaced), `.env.test.local` and `.env.local` (add the local service role key)

**Interfaces:**
- Produces (all `security definer`, executable by `service_role` only):
  - `ai_check(p_user uuid, p_cost int) → text` — `'ok' | 'rate_limited' | 'daily_limit' | 'fair_use'`; on `'ok'` records an `ai_requests` row. `p_cost` 0–10.
  - `ai_charge(p_user uuid, p_cost int) → void` — inserts `ai_charges` (cost 1–10; 0 is a no-op).
  - `apply_payment(p_user uuid, p_reference text, p_product text, p_amount_minor int, p_currency text, p_channel text, p_status text, p_months int, p_paid_at timestamptz, p_customer_code text, p_card_brand text, p_card_last4 text) → timestamptz` — inserts the payment (a known reference does nothing), extends Premium only for a newly inserted `success`, returns `premium_until`.
  - `set_subscription(p_user uuid, p_subscription_code text, p_email_token text, p_auto_renew boolean) → void`
  - `apply_refund(p_reference text) → void`
- Tables: `entitlements`, `payments`, `billing_events(id text pk, provider, type, received_at)`, `ai_charges(id, user_id, cost, at)`. `ai_request_allowed()` is dropped.
- Test helper: `adminClient(): SupabaseClient` (service role).

- [ ] **Step 1: Add the local service role key**

Run `npx supabase status -o env` and copy `SERVICE_ROLE_KEY` (the local demo key, not a production secret). Append to both `.env.test.local` and `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=<that value>
```
Both files are git-ignored. Then add to `tests/db/helpers.ts`:

```ts
// Service-role client: what the server uses for billing and usage (bypasses RLS)
export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 2: Write the failing DB test** — `tests/db/billing.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { newUser, adminClient } from './helpers'

const admin = () => adminClient()
const check = (user: string, cost: number) => admin().rpc('ai_check', { p_user: user, p_cost: cost })
const charge = (user: string, cost: number) => admin().rpc('ai_charge', { p_user: user, p_cost: cost })
const pay = (user: string, reference: string, over: Record<string, unknown> = {}) => admin().rpc('apply_payment', {
  p_user: user, p_reference: reference, p_product: 'pass_1m', p_amount_minor: 5000, p_currency: 'GHS',
  p_channel: 'mobile_money', p_status: 'success', p_months: 1, p_paid_at: new Date().toISOString(),
  p_customer_code: 'CUS_1', p_card_brand: null, p_card_last4: null, ...over,
})
const ref = () => `T${crypto.randomUUID()}`

describe('usage functions are server-only', () => {
  it('students cannot call ai_check, ai_charge or apply_payment', async () => {
    const u = await newUser()
    expect((await u.sb.rpc('ai_check', { p_user: u.id, p_cost: 1 })).error).not.toBeNull()
    expect((await u.sb.rpc('ai_charge', { p_user: u.id, p_cost: -5 })).error).not.toBeNull()
    expect((await u.sb.rpc('apply_payment', { p_user: u.id, p_reference: 'x', p_product: 'pass_12m', p_amount_minor: 0, p_currency: 'GHS', p_channel: 'card', p_status: 'success', p_months: 12, p_paid_at: new Date().toISOString(), p_customer_code: null, p_card_brand: null, p_card_last4: null })).error).not.toBeNull()
    expect((await u.sb.rpc('ai_request_allowed')).error).not.toBeNull() // replaced by ai_check
  })
  it('students can read but not write their own plan, payments and usage', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    await charge(u.id, 2)
    expect((await u.sb.from('entitlements').select('premium_until').single()).data?.premium_until).toBeTruthy()
    expect((await u.sb.from('payments').select('id')).data).toHaveLength(1)
    expect((await u.sb.from('ai_charges').select('cost')).data).toEqual([{ cost: 2 }])
    await u.sb.from('entitlements').update({ premium_until: '2099-01-01T00:00:00Z' }).eq('user_id', u.id)
    await u.sb.from('ai_charges').delete().eq('user_id', u.id)
    expect((await u.sb.from('entitlements').insert({ user_id: u.id, premium_until: '2099-01-01T00:00:00Z' })).error).not.toBeNull()
    const ent = (await u.sb.from('entitlements').select('premium_until').single()).data!
    expect(new Date(ent.premium_until).getFullYear()).toBeLessThan(2099)
    expect((await u.sb.from('ai_charges').select('cost')).data).toHaveLength(1)
    expect((await u.sb.from('billing_events').select('id')).data).toEqual([])
  })
})

describe('Free plan: 10 AI actions a day, by cost', () => {
  it('allows up to 10 cost, then says daily_limit', async () => {
    const u = await newUser()
    expect((await check(u.id, 3)).data).toBe('ok'); await charge(u.id, 3)
    expect((await check(u.id, 7)).data).toBe('ok'); await charge(u.id, 7)
    expect((await check(u.id, 1)).data).toBe('daily_limit')
    expect((await check(u.id, 0)).data).toBe('ok') // free marking still allowed
  })
  it('a big job that would pass the limit is refused even with some left', async () => {
    const u = await newUser()
    await charge(u.id, 8)
    expect((await check(u.id, 3)).data).toBe('daily_limit')
    expect((await check(u.id, 2)).data).toBe('ok')
  })
  it('the speed limit applies to everyone: 10 requests a minute', async () => {
    const u = await newUser()
    const results = await Promise.all(Array.from({ length: 12 }, () => check(u.id, 0)))
    expect(results.filter(r => r.data === 'ok')).toHaveLength(10)
    expect(results.filter(r => r.data === 'rate_limited')).toHaveLength(2)
  })
  it('rejects costs outside 0–10', async () => {
    const u = await newUser()
    expect((await check(u.id, -1)).error).not.toBeNull()
    expect((await check(u.id, 11)).error).not.toBeNull()
  })
})

describe('Premium: no daily limit, fair use 400 a month', () => {
  it('a Premium student passes the daily limit', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    await charge(u.id, 10)
    expect((await check(u.id, 5)).data).toBe('ok')
  })
  it('stops at 400 this month with fair_use', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    for (let i = 0; i < 40; i++) await charge(u.id, 10)
    expect((await check(u.id, 1)).data).toBe('fair_use')
  })
  it('when Premium has ended, the free daily limit applies at once', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    await admin().from('entitlements').update({ premium_until: new Date(Date.now() - 1000).toISOString() }).eq('user_id', u.id)
    await charge(u.id, 10)
    expect((await check(u.id, 1)).data).toBe('daily_limit')
  })
})

describe('apply_payment', () => {
  it('starts Premium from now and stacks a second pass on the end date', async () => {
    const u = await newUser()
    const first = new Date((await pay(u.id, ref())).data as string)
    const second = new Date((await pay(u.id, ref(), { p_product: 'pass_3m', p_amount_minor: 13500, p_months: 3 })).data as string)
    const days = (second.getTime() - first.getTime()) / 86_400_000
    expect(days).toBeGreaterThan(88)
    expect(days).toBeLessThan(93)
  })
  it('credits a reference only once, even when called at the same time', async () => {
    const u = await newUser()
    const r = ref()
    const results = await Promise.all([pay(u.id, r), pay(u.id, r), pay(u.id, r)])
    expect(results.every(x => !x.error)).toBe(true)
    expect((await admin().from('payments').select('id').eq('reference', r)).data).toHaveLength(1)
    const until = new Date((await admin().from('entitlements').select('premium_until').eq('user_id', u.id).single()).data!.premium_until)
    expect((until.getTime() - Date.now()) / 86_400_000).toBeLessThan(32)
  })
  it('records failed and needs_review payments without extending Premium', async () => {
    const u = await newUser()
    await pay(u.id, ref(), { p_status: 'needs_review' })
    const ent = (await admin().from('entitlements').select('premium_until').eq('user_id', u.id).maybeSingle()).data
    expect(ent?.premium_until ?? null).toBeNull()
  })
  it('a refund takes the months back off', async () => {
    const u = await newUser()
    await pay(u.id, ref())
    const r = ref()
    const before = new Date((await pay(u.id, r, { p_product: 'pass_12m', p_amount_minor: 48000, p_months: 12 })).data as string)
    await admin().rpc('apply_refund', { p_reference: r })
    const after = new Date((await admin().from('entitlements').select('premium_until').eq('user_id', u.id).single()).data!.premium_until)
    expect((before.getTime() - after.getTime()) / 86_400_000).toBeGreaterThan(360)
    expect((await admin().from('payments').select('status').eq('reference', r).single()).data!.status).toBe('refunded')
  })
  it('set_subscription records auto-renew', async () => {
    const u = await newUser()
    await admin().rpc('set_subscription', { p_user: u.id, p_subscription_code: 'SUB_1', p_email_token: 'tok', p_auto_renew: true })
    const ent = (await u.sb.from('entitlements').select('auto_renew,subscription_code').single()).data!
    expect(ent).toEqual({ auto_renew: true, subscription_code: 'SUB_1' })
  })
})
```

Also in `tests/db/aiSpeedLimit.test.ts`, replace every `u.sb.rpc('ai_request_allowed')` with the server path `adminClient().rpc('ai_check', { p_user: u.id, p_cost: 0 })` and compare `.data === 'ok'` / `'rate_limited'` instead of `true`/`false` (import `adminClient`); keep the "cannot be bypassed by editing the request log" test but call `ai_check` the same way.

- [ ] **Step 3: Run to see it fail**

Run: `npm run test:db -- billing`
Expected: FAIL — `ai_check` does not exist.

- [ ] **Step 4: Write the migration** — `supabase/migrations/20261007000000_billing.sql`

```sql
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
```

- [ ] **Step 5: Apply and run**

Run: `npx supabase migration up` then `npm run test:db`
Expected: all DB tests PASS (the "credits a reference only once" test proves Review Focus #1; "Premium has ended" proves #3).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261007000000_billing.sql tests/db
git commit -m "feat: billing tables and server-only usage and payment functions"
```

---

### Task 2: Plan constants and the service-role client

**Files:**
- Create: `lib/billing/plans.ts`, `lib/supabase/admin.ts`, `tests/unit/billingPlans.test.ts`
- Modify: `package.json` (add `server-only`)

**Interfaces:**
- Produces:
  - `FREE_DAILY_ACTIONS = 10`, `FAIR_USE_MONTHLY_ACTIONS = 400`, `FAIR_USE_TRANSCRIPT_HOURS = 20`, `SPEED_LIMIT_PER_MINUTE = 10`
  - `type ProductId = 'pass_1m' | 'pass_3m' | 'pass_12m' | 'renew_1m' | 'renew_12m'`; `PRODUCTS: Record<ProductId, { months: number; amountMinor: number; label: string }>`
  - `type CheckoutChoice = '1m' | '3m' | '12m'`; `CHOICES: Record<CheckoutChoice, { pass: ProductId; renew: ProductId | null; save: string | null }>`
  - `formatGhs(minor: number): string` → `"GHS 50"` / `"GHS 13.50"`
  - `pdfActionCost(pages: number): number` (1 per 10 pages, rounded up, 1–10)
  - `adminClient(): SupabaseClient` (server-only)
  - `isBillingConfigured(): boolean`

- [ ] **Step 1: Write the failing test** — `tests/unit/billingPlans.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { CHOICES, FAIR_USE_MONTHLY_ACTIONS, FREE_DAILY_ACTIONS, PRODUCTS, SPEED_LIMIT_PER_MINUTE, formatGhs, pdfActionCost } from '@/lib/billing/plans'

const sql = fs.readFileSync('supabase/migrations/20261007000000_billing.sql', 'utf8')

describe('plan constants', () => {
  it('match the limits enforced in SQL', () => {
    expect(sql).toContain(`> ${FREE_DAILY_ACTIONS} then return 'daily_limit'`)
    expect(sql).toContain(`> ${FAIR_USE_MONTHLY_ACTIONS} then return 'fair_use'`)
    expect(sql).toContain(`>= ${SPEED_LIMIT_PER_MINUTE} then\n    return 'rate_limited'`)
  })
  it('have the agreed prices in pesewas', () => {
    expect(PRODUCTS.pass_1m).toMatchObject({ months: 1, amountMinor: 5000 })
    expect(PRODUCTS.pass_3m).toMatchObject({ months: 3, amountMinor: 13500 })
    expect(PRODUCTS.pass_12m).toMatchObject({ months: 12, amountMinor: 48000 })
    expect(PRODUCTS.renew_1m.amountMinor).toBe(5000)
    expect(PRODUCTS.renew_12m.amountMinor).toBe(48000)
    expect(CHOICES['3m'].renew).toBeNull() // no auto-renew for 3 months
  })
  it('formats cedis', () => {
    expect(formatGhs(5000)).toBe('GHS 50')
    expect(formatGhs(13550)).toBe('GHS 135.50')
  })
  it('costs PDFs 1 AI action per 10 pages', () => {
    expect([0, 1, 10, 11, 25, 100, 400].map(pdfActionCost)).toEqual([1, 1, 1, 2, 3, 10, 10])
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/billingPlans.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `lib/billing/plans.ts`

```ts
// Plan limits and prices. The limits are also enforced in SQL (supabase/migrations/…_billing.sql);
// tests/unit/billingPlans.test.ts keeps the two in step.
export const FREE_DAILY_ACTIONS = 10
export const FAIR_USE_MONTHLY_ACTIONS = 400
export const FAIR_USE_TRANSCRIPT_HOURS = 20
export const SPEED_LIMIT_PER_MINUTE = 10

export type ProductId = 'pass_1m' | 'pass_3m' | 'pass_12m' | 'renew_1m' | 'renew_12m'
export const PRODUCTS: Record<ProductId, { months: number; amountMinor: number; label: string }> = {
  pass_1m: { months: 1, amountMinor: 5000, label: '1 month' },
  pass_3m: { months: 3, amountMinor: 13500, label: '3 months' },
  pass_12m: { months: 12, amountMinor: 48000, label: '1 year' },
  renew_1m: { months: 1, amountMinor: 5000, label: '1 month (renewal)' },
  renew_12m: { months: 12, amountMinor: 48000, label: '1 year (renewal)' },
}

export type CheckoutChoice = '1m' | '3m' | '12m'
export const CHOICES: Record<CheckoutChoice, { pass: ProductId; renew: ProductId | null; save: string | null }> = {
  '1m': { pass: 'pass_1m', renew: 'renew_1m', save: null },
  '3m': { pass: 'pass_3m', renew: null, save: 'save 10%' },
  '12m': { pass: 'pass_12m', renew: 'renew_12m', save: 'save 20%' },
}

export function formatGhs(minor: number): string {
  const cedis = minor / 100
  return `GHS ${Number.isInteger(cedis) ? cedis : cedis.toFixed(2)}`
}

// AI actions a PDF costs: 1 per 10 pages, rounded up (an unreadable page count counts as 1)
export const pdfActionCost = (pages: number) => Math.min(10, Math.max(1, Math.ceil(pages / 10)))
```

`lib/supabase/admin.ts`

```ts
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role client: bypasses row-level security. Only for billing and AI usage on the server.
export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const isBillingConfigured = () => !!process.env.PAYSTACK_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY
```

Run `npm install server-only`. In `vitest.config.ts`, alias `server-only` to an empty module for tests if Vitest errors on it: add `resolve.alias: { 'server-only': path.resolve(__dirname, 'tests/empty.ts') }` with `tests/empty.ts` containing `export {}`.

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/billingPlans.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/plans.ts lib/supabase/admin.ts tests/unit/billingPlans.test.ts package.json package-lock.json vitest.config.ts tests/empty.ts
git commit -m "feat: plan limits, prices and the server-only service-role client"
```

---

### Task 3: `runAiAction` on the plan checks (free limit, fair use, charge on success)

**Files:**
- Modify: `lib/ai/run.ts`, `lib/ai/routeNote.ts`, `app/api/ai/summary/route.ts`, `app/api/ai/flashcards/route.ts`, `app/api/ai/quiz/route.ts`, `app/api/ai/quiz/mark/route.ts`, `app/api/import/pdf/route.ts`
- Test: `tests/unit/aiRun.test.ts`, `tests/unit/aiSummary.test.ts`, `tests/unit/aiFlashcardsRoute.test.ts`, `tests/unit/aiQuizRoute.test.ts`, `tests/unit/quizMarking.test.ts`, `tests/unit/importPdfRoute.test.ts`

**Interfaces:**
- Consumes: `ai_check`, `ai_charge` (Task 1), `adminClient`, `pdfActionCost` (Task 2).
- Produces:
  - `runAiAction<T>(call: (client: AiClient) => Promise<T>, opts: { userId: string; cost: number; signal?: AbortSignal; client?: AiClient }): Promise<AiResult<T>>`
  - `AiErrorCode` gains `'daily_limit'` and `'fair_use'` (both HTTP **402**).
  - `readOwnNote` result gains `userId: string`.

- [ ] **Step 1: Rewrite the `runAiAction` tests** — replace the `describe('runAiAction', …)` block and the `fakeSb` helper in `tests/unit/aiRun.test.ts`:

```ts
const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc }) }))
const result = (check: string) => rpc.mockImplementation(async (fn: string) => ({ data: fn === 'ai_check' ? check : null, error: null }))
const calls = () => rpc.mock.calls.map(c => [c[0], (c[1] as { p_cost: number }).p_cost])

describe('runAiAction', () => {
  beforeEach(() => rpc.mockReset())
  it('checks the plan, runs the call, then charges its cost', async () => {
    result('ok')
    const r = await runAiAction(async () => 42, { userId: 'u1', cost: 3, client })
    expect(r).toEqual({ ok: true, value: 42 })
    expect(calls()).toEqual([['ai_check', 3], ['ai_charge', 3]])
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_user: 'u1' })
  })
  it('does not charge failed calls', async () => {
    result('ok')
    const r = await runAiAction(async () => { throw asError(OpenAI.RateLimitError) }, { userId: 'u1', cost: 1, client })
    expect(r).toEqual({ ok: false, error: 'busy' })
    expect(calls()).toEqual([['ai_check', 1]])
  })
  it.each([['rate_limited'], ['daily_limit'], ['fair_use']])('refuses without calling the AI when the check says %s', async code => {
    result(code)
    const call = vi.fn()
    expect(await runAiAction(call, { userId: 'u1', cost: 1, client })).toEqual({ ok: false, error: code })
    expect(call).not.toHaveBeenCalled()
  })
  it('free marking (cost 0) is checked for speed but never charged', async () => {
    result('ok')
    await runAiAction(async () => 1, { userId: 'u1', cost: 0, client })
    expect(calls()).toEqual([['ai_check', 0]])
  })
  it('says AI is unavailable when no key is set, without checking anything', async () => {
    delete process.env.OPENAI_API_KEY
    expect(await runAiAction(vi.fn(), { userId: 'u1', cost: 1 })).toEqual({ ok: false, error: 'ai_unavailable' })
    expect(rpc).not.toHaveBeenCalled()
  })
})
```
and in the `aiErrorResponse` test add: `expect(aiErrorResponse('daily_limit').status).toBe(402)` and `expect(aiErrorResponse('fair_use').status).toBe(402)`.

In each route test (`aiSummary`, `aiFlashcardsRoute`, `aiQuizRoute`, `quizMarking`, `importPdfRoute`):
- add `vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))` with `const adminRpc = vi.fn(async (fn: string) => ({ data: fn === 'ai_check' ? check : null, error: null }))` and `let check = 'ok'` (reset in `beforeEach`);
- remove `ai_request_allowed` from the session `sb.rpc` fakes and replace assertions on `sb.rpc` call names with `adminRpc` calls, e.g. summary: `expect(adminRpc.mock.calls.map(c => c[0])).toEqual(['ai_check', 'ai_charge'])`;
- the "going too fast" tests set `check = 'rate_limited'` and still expect 429 `rate_limited`;
- add to `aiSummary.test.ts`:

```ts
  it('tells a Free student they have used today\'s actions (402), without calling the AI', async () => {
    check = 'daily_limit'
    const res = await call({ noteId: NOTE_ID })
    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({ error: 'daily_limit' })
    expect(parse).not.toHaveBeenCalled()
  })
```
- add to `importPdfRoute.test.ts`:

```ts
  it('charges 1 AI action per 10 pages', async () => {
    pdfBytes = Buffer.from('%PDF-1.4\n' + '1 0 obj << /Type /Page >> endobj\n'.repeat(25) + '%%EOF')
    await call({ path: 'u1/a.pdf' })
    expect(adminRpc.mock.calls.map(c => [c[0], (c[1] as { p_cost: number }).p_cost])).toEqual([['ai_check', 3], ['ai_charge', 3]])
  })
```
- add to `quizMarking.test.ts` (route part): `expect(adminRpc.mock.calls.map(c => [c[0], (c[1] as { p_cost: number }).p_cost])).toEqual([['ai_check', 0]])` in the "asks the AI for other answers" test.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/unit/aiRun.test.ts tests/unit/aiSummary.test.ts tests/unit/aiFlashcardsRoute.test.ts tests/unit/aiQuizRoute.test.ts tests/unit/quizMarking.test.ts tests/unit/importPdfRoute.test.ts`
Expected: FAIL (old signature / `ai_request_allowed`).

- [ ] **Step 3: Implement** — `lib/ai/run.ts`

```ts
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { AiEmptyError, AiIncompleteError, AiRefusedError, isAiConfigured, openai, type AiClient } from './openai'

export type AiErrorCode = 'ai_unavailable' | 'rate_limited' | 'daily_limit' | 'fair_use' | 'busy' | 'refused' | 'too_long' | 'empty' | 'ai_failed' | 'aborted'
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiErrorCode }

const STATUS: Record<AiErrorCode, number> = {
  ai_unavailable: 503, rate_limited: 429, daily_limit: 402, fair_use: 402, busy: 429,
  refused: 422, too_long: 413, empty: 422, ai_failed: 502, aborted: 499,
}

// Every AI feature goes through here: the plan check (speed limit, Free daily limit or Premium fair
// use) before the call, and the charge only after it succeeds. Both run with the service role, so a
// student can't skip, fake or refund their own usage. Cost 0 (quiz marking) is speed-limited only.
export async function runAiAction<T>(
  call: (client: AiClient) => Promise<T>,
  opts: { userId: string; cost: number; signal?: AbortSignal; client?: AiClient },
): Promise<AiResult<T>> {
  if (!opts.client && !isAiConfigured()) return { ok: false, error: 'ai_unavailable' }
  const admin = adminClient()
  const { data: check, error } = await admin.rpc('ai_check', { p_user: opts.userId, p_cost: opts.cost })
  if (error) return { ok: false, error: 'ai_failed' }
  if (check !== 'ok') return { ok: false, error: check as AiErrorCode }
  try {
    const value = await call(opts.client ?? openai())
    if (opts.cost > 0) await admin.rpc('ai_charge', { p_user: opts.userId, p_cost: opts.cost })
    return { ok: true, value }
  } catch (e) {
    return { ok: false, error: classifyAiError(e, opts.signal) }
  }
}
```
(keep `classifyAiError` and `aiErrorResponse` unchanged.)

`lib/ai/routeNote.ts`: return `{ sb, note, body: body!, userId: user.id }` and add `userId: string` to the result type.

Routes:
- summary / flashcards: `runAiAction(client => …, { userId: r.userId, cost: 1, signal: request.signal })`
- quiz: `runAiAction(async client => { … }, { userId: r.userId, cost: 1, signal: request.signal })` (inside the call, keep using `r.sb` for the insert)
- mark: `runAiAction(client => markShortAnswer(client, q, answer, request.signal), { userId: user.id, cost: 0, signal: request.signal })`
- PDF: import `pdfActionCost` from `@/lib/billing/plans`; `runAiAction(client => pdfToNote(…), { userId: user.id, cost: pdfActionCost(countPages(bytes)), signal: request.signal })`

- [ ] **Step 4: Run to see them pass**

Run the Step 2 command, then `npx tsc --noEmit -p .` and `npm test`.
Expected: PASS; types clean.

- [ ] **Step 5: Commit**

```bash
git add lib/ai app/api tests/unit
git commit -m "feat: AI routes use the plan checks — free daily limit, Premium fair use, charge on success"
```

---

### Task 4: Plan state in the browser, the limit prompt, and AI error display

**Files:**
- Create: `components/billing/usePlan.ts`, `components/billing/LimitPrompt.tsx`, `components/ai/AiError.tsx`, `tests/unit/limitPrompt.test.tsx`
- Modify: `components/ai/aiFetch.ts` (messages, announce), `components/notes/study/SummaryTab.tsx`, `CardsTab.tsx`, `QuizTab.tsx`, `StudyPanel.tsx`, `lib/import/pdfImport.ts`

**Interfaces:**
- Consumes: `entitlements`, `ai_charges` (readable by the student), `FREE_DAILY_ACTIONS`.
- Produces:
  - `PLAN_CHANGED = 'studyhub:plan-changed'`, `announcePlanChanged()`
  - `usePlan(): { loading: boolean; billing: boolean; premiumUntil: Date | null; isPremium: boolean; autoRenew: boolean; cardLabel: string | null; usedToday: number; usedThisMonth: number }`
  - `loadPlan(sb, now: Date): Promise<Omit<ReturnType<typeof usePlan>, 'loading' | 'billing'>>`
  - `freeAllowanceText(usedToday: number): string` — `"7 of 10 free AI actions left today"`
  - `<LimitPrompt kind="daily_limit" | "fair_use" | "premium_required" />`
  - `<AiError code={string} message={string} />`
  - `postAi` resolves errors as `{ ok: false; error; message }` (unchanged) and dispatches `AI_USED` on success; `AI_USED = 'studyhub:ai-used'` exported from `components/ai/aiFetch.ts`.
  - Server: `GET`-free — billing availability comes from `NEXT_PUBLIC_BILLING_ENABLED` (`'1'` when Paystack is configured; set in Vercel alongside the keys) so the client knows whether to show upgrade buttons.

- [ ] **Step 1: Write the failing test** — `tests/unit/limitPrompt.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LimitPrompt } from '@/components/billing/LimitPrompt'
import { AiError } from '@/components/ai/AiError'
import { freeAllowanceText, loadPlan } from '@/components/billing/usePlan'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T17:20:00Z')); process.env.NEXT_PUBLIC_BILLING_ENABLED = '1' })
afterEach(() => { cleanup(); vi.useRealTimers(); delete process.env.NEXT_PUBLIC_BILLING_ENABLED })

describe('LimitPrompt', () => {
  it('explains the free daily limit with the reset time and a Get Premium link', () => {
    render(<LimitPrompt kind="daily_limit" />)
    expect(screen.getByText('You\'ve used today\'s 10 free AI actions')).toBeTruthy()
    expect(screen.getByText(/They reset in 6h 40m\. Premium has no daily limit\./)).toBeTruthy()
    expect(screen.getByRole('link', { name: '✦ Get Premium · GHS 50/month' }).getAttribute('href')).toBe('/plans')
  })
  it('explains Premium fair use', () => {
    render(<LimitPrompt kind="fair_use" />)
    expect(screen.getByText('You\'ve reached fair use for this month')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Get Premium/ })).toBeNull()
  })
  it('hides the upgrade link when billing is not set up', () => {
    delete process.env.NEXT_PUBLIC_BILLING_ENABLED
    render(<LimitPrompt kind="daily_limit" />)
    expect(screen.queryByRole('link', { name: /Get Premium/ })).toBeNull()
  })
})

describe('AiError', () => {
  it('shows the limit prompt for plan limits and a plain alert otherwise', () => {
    const { rerender } = render(<AiError code="daily_limit" message="x" />)
    expect(screen.getByText('You\'ve used today\'s 10 free AI actions')).toBeTruthy()
    rerender(<AiError code="busy" message="Couldn't reach the AI. Try again." />)
    expect(screen.getByRole('alert').textContent).toBe('Couldn\'t reach the AI. Try again.')
  })
})

describe('plan state', () => {
  it('counts today\'s and this month\'s usage and reads Premium', async () => {
    const sb = {
      from: (t: string) => t === 'entitlements'
        ? { select: () => ({ maybeSingle: async () => ({ data: { premium_until: '2026-11-04T00:00:00Z', auto_renew: true, card_brand: 'visa', card_last4: '4242' }, error: null }) }) }
        : { select: () => ({ gte: async () => ({ data: [{ cost: 2, at: '2026-10-04T08:00:00Z' }, { cost: 3, at: '2026-10-01T08:00:00Z' }], error: null }) }) },
    }
    const p = await loadPlan(sb as never, new Date('2026-10-04T17:20:00Z'))
    expect(p).toMatchObject({ isPremium: true, autoRenew: true, cardLabel: 'Visa •• 4242', usedToday: 2, usedThisMonth: 5 })
    expect(freeAllowanceText(3)).toBe('7 of 10 free AI actions left today')
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/limitPrompt.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement** — `components/billing/usePlan.ts`

```ts
'use client'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { FREE_DAILY_ACTIONS } from '@/lib/billing/plans'
import { AI_USED } from '@/components/ai/aiFetch'

export const PLAN_CHANGED = 'studyhub:plan-changed'
export const announcePlanChanged = () => { window.dispatchEvent(new Event(PLAN_CHANGED)) }
export const billingEnabled = () => process.env.NEXT_PUBLIC_BILLING_ENABLED === '1'

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))

export async function loadPlan(sb: SupabaseClient, now: Date) {
  const [{ data: ent }, { data: charges }] = await Promise.all([
    sb.from('entitlements').select('premium_until,auto_renew,card_brand,card_last4').maybeSingle(),
    sb.from('ai_charges').select('cost,at').gte('at', startOfUtcMonth(now).toISOString()),
  ])
  const premiumUntil = ent?.premium_until ? new Date(ent.premium_until) : null
  const day = startOfUtcDay(now).getTime()
  const rows = (charges ?? []) as { cost: number; at: string }[]
  const brand = ent?.card_brand ? ent.card_brand[0].toUpperCase() + ent.card_brand.slice(1) : null
  return {
    premiumUntil,
    isPremium: !!premiumUntil && premiumUntil.getTime() > now.getTime(),
    autoRenew: !!ent?.auto_renew,
    cardLabel: brand && ent?.card_last4 ? `${brand} •• ${ent.card_last4}` : null,
    usedToday: rows.filter(r => new Date(r.at).getTime() >= day).reduce((s, r) => s + r.cost, 0),
    usedThisMonth: rows.reduce((s, r) => s + r.cost, 0),
  }
}

export const freeAllowanceText = (usedToday: number) =>
  `${Math.max(0, FREE_DAILY_ACTIONS - usedToday)} of ${FREE_DAILY_ACTIONS} free AI actions left today`

type Plan = Awaited<ReturnType<typeof loadPlan>> & { loading: boolean; billing: boolean }
const EMPTY = { premiumUntil: null, isPremium: false, autoRenew: false, cardLabel: null, usedToday: 0, usedThisMonth: 0 }

// The signed-in student's plan and usage; refreshes after AI use or a plan change
export function usePlan(): Plan {
  const [plan, setPlan] = useState<Plan>({ ...EMPTY, loading: true, billing: billingEnabled() })
  useEffect(() => {
    let live = true
    const load = () => { loadPlan(supabase(), new Date()).then(p => { if (live) setPlan({ ...p, loading: false, billing: billingEnabled() }) }).catch(() => {}) }
    load()
    window.addEventListener(AI_USED, load); window.addEventListener(PLAN_CHANGED, load)
    return () => { live = false; window.removeEventListener(AI_USED, load); window.removeEventListener(PLAN_CHANGED, load) }
  }, [])
  return plan
}
```

`components/billing/LimitPrompt.tsx`

```tsx
'use client'
import Link from 'next/link'
import { FREE_DAILY_ACTIONS, PRODUCTS, formatGhs } from '@/lib/billing/plans'
import { billingEnabled } from './usePlan'

function resetIn(now: Date) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  const mins = Math.max(1, Math.ceil((next - now.getTime()) / 60_000))
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const TEXT = {
  daily_limit: { title: `You've used today's ${FREE_DAILY_ACTIONS} free AI actions`, body: () => `They reset in ${resetIn(new Date())}. Premium has no daily limit.`, upgrade: true },
  fair_use: { title: 'You\'ve reached fair use for this month', body: () => 'Premium AI comes back on the 1st. Everything else keeps working.', upgrade: false },
  premium_required: { title: 'This is a Premium feature', body: () => 'Premium includes accurate lecture transcripts and unlimited AI.', upgrade: true },
} as const

export function LimitPrompt({ kind }: { kind: keyof typeof TEXT }) {
  const t = TEXT[kind]
  return (
    <div role="status" className="rounded-xl bg-accent-soft p-3 text-sm">
      <p className="font-medium">{t.title}</p>
      <p className="mt-0.5 text-xs text-muted">{t.body()}</p>
      {t.upgrade && billingEnabled() && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link href="/plans" className="btn-primary">✦ Get Premium · {formatGhs(PRODUCTS.pass_1m.amountMinor)}/month</Link>
          <Link href="/plans" className="text-xs text-accent">See plans</Link>
        </div>
      )}
    </div>
  )
}
```
(The second link has the same destination but the accessible name "See plans", so the test's exact-name query finds one "Get Premium" link.)

`components/ai/AiError.tsx`

```tsx
'use client'
import { LimitPrompt } from '@/components/billing/LimitPrompt'

export function AiError({ code, message }: { code: string; message: string }) {
  if (code === 'daily_limit' || code === 'fair_use' || code === 'premium_required') return <LimitPrompt kind={code} />
  return <p role="alert" className="text-sm text-danger">{message}</p>
}
```

`components/ai/aiFetch.ts`: export `AI_USED = 'studyhub:ai-used'`; on `res.ok` call `window.dispatchEvent(new Event(AI_USED))` before returning; add messages `daily_limit: 'You\'ve used today\'s free AI actions.'`, `fair_use: 'You\'ve reached fair use for this month.'`.

Study tabs: change each tab's error state from `string | null` to `{ code: string; message: string } | null`, set it from `postAi` as `setError({ code: r.error, message: r.message })`, and render `{error && <AiError code={error.code} message={error.message} />}` in place of the `role="alert"` paragraph (CardsTab's save error uses `{ code: 'save', message: 'Couldn\'t save the cards. Try again.' }`). In `StudyPanel.tsx`, under the tabs, show `{plan.billing && !plan.isPremium && !plan.loading && <p className="mt-4 text-xs text-muted" aria-live="polite">{freeAllowanceText(plan.usedToday)}</p>}` using `const plan = usePlan()`.

`lib/import/pdfImport.ts` messages: add `daily_limit: 'You\'ve used today\'s free AI actions (PDFs use 1 per 10 pages), so only the plain text was kept. Premium has no daily limit.'` and `fair_use: 'You\'ve reached this month\'s fair use, so only the plain text was kept.'`.

Update `tests/unit/studyPanel.test.tsx`: the "explains errors" test still expects `getByRole('alert')` with "too short" (unchanged path); add:

```tsx
  it('shows the Get Premium prompt when the free limit is reached', async () => {
    process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
    fetchMock.mockImplementation(() => fail(402, 'daily_limit'))
    setup()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '✦ Summarise' })) })
    expect(screen.getByText('You\'ve used today\'s 10 free AI actions')).toBeTruthy()
    delete process.env.NEXT_PUBLIC_BILLING_ENABLED
  })
```
(and give the panel's `@/lib/supabase/client` mock a `from` that returns empty plan data: `from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null }), gte: async () => ({ data: [] }) }) })`).

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/limitPrompt.test.tsx tests/unit/studyPanel.test.tsx tests/unit/quizPlayer.test.tsx tests/unit/pdfImport.test.ts` then `npx tsc --noEmit -p .` and `npx eslint .`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add components/billing components/ai components/notes/study lib/import/pdfImport.ts tests/unit
git commit -m "feat: free allowance, the Get Premium prompt and plan state in the app"
```

---

### Task 5: Paystack client

**Files:**
- Create: `lib/billing/paystack.ts`, `tests/unit/paystack.test.ts`

**Interfaces:**
- Produces:
  - `type VerifiedCharge = { reference: string; status: 'success' | 'failed' | 'pending'; amountMinor: number; currency: string; channel: 'mobile_money' | 'card' | 'other'; paidAt: string | null; userId: string | null; product: string | null; planCode: string | null; customerCode: string | null; cardBrand: string | null; cardLast4: string | null }`
  - `paystackBase(): string`
  - `initializeCheckout(o: { email: string; amountMinor: number; callbackUrl: string; channels: ('card' | 'mobile_money')[]; metadata: { user_id: string; product: string }; planCode?: string }): Promise<{ url: string; reference: string }>`
  - `verifyTransaction(reference: string): Promise<VerifiedCharge>`
  - `disableSubscription(code: string, token: string): Promise<void>`
  - `verifySignature(rawBody: string, header: string | null): boolean`
  - `parseCharge(data: unknown): VerifiedCharge` (shared by verify and webhook)
  - `class PaystackError extends Error`

- [ ] **Step 1: Write the failing test** — `tests/unit/paystack.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { disableSubscription, initializeCheckout, parseCharge, verifySignature, verifyTransaction } from '@/lib/billing/paystack'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); process.env.PAYSTACK_SECRET_KEY = 'sk_test_x'; delete process.env.PAYSTACK_BASE_URL })
afterEach(() => { vi.unstubAllGlobals(); delete process.env.PAYSTACK_SECRET_KEY })
const reply = (body: object, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))

describe('verifySignature', () => {
  const body = '{"event":"charge.success"}'
  const sig = crypto.createHmac('sha512', 'sk_test_x').update(body).digest('hex')
  it('accepts Paystack\'s HMAC-SHA512 of the raw body', () => { expect(verifySignature(body, sig)).toBe(true) })
  it('rejects a wrong, missing or tampered signature', () => {
    expect(verifySignature(body, 'nope')).toBe(false)
    expect(verifySignature(body, null)).toBe(false)
    expect(verifySignature(body + ' ', sig)).toBe(false)
  })
})

describe('initializeCheckout', () => {
  it('posts the amount in pesewas, GHS, channels, metadata and plan with the secret key', async () => {
    reply({ status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', reference: 'R1' } })
    const out = await initializeCheckout({ email: 'a@b.c', amountMinor: 5000, callbackUrl: 'https://x/plans/return', channels: ['card', 'mobile_money'], metadata: { user_id: 'u1', product: 'pass_1m' } })
    expect(out).toEqual({ url: 'https://checkout.paystack.com/abc', reference: 'R1' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.paystack.co/transaction/initialize')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_x')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.c', amount: 5000, currency: 'GHS', callback_url: 'https://x/plans/return', channels: ['card', 'mobile_money'], metadata: { user_id: 'u1', product: 'pass_1m' } })
  })
  it('includes the plan code for auto-renew and throws PaystackError on failure', async () => {
    reply({ status: true, data: { authorization_url: 'u', reference: 'R' } })
    await initializeCheckout({ email: 'a@b.c', amountMinor: 5000, callbackUrl: 'c', channels: ['card'], metadata: { user_id: 'u', product: 'renew_1m' }, planCode: 'PLN_m' })
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).plan).toBe('PLN_m')
    reply({ status: false, message: 'bad' }, 400)
    await expect(initializeCheckout({ email: 'a', amountMinor: 1, callbackUrl: 'c', channels: ['card'], metadata: { user_id: 'u', product: 'pass_1m' } })).rejects.toThrow('bad')
  })
})

describe('parseCharge / verifyTransaction', () => {
  const data = {
    status: 'success', reference: 'R1', amount: 5000, currency: 'GHS', channel: 'mobile_money', paid_at: '2026-10-04T10:00:00Z',
    metadata: '{"user_id":"u1","product":"pass_1m"}', customer: { customer_code: 'CUS_1' }, authorization: { last4: '4242', brand: 'visa' }, plan: { plan_code: 'PLN_m' },
  }
  it('normalises Paystack\'s fields (metadata may be a JSON string, plan an object or code)', () => {
    expect(parseCharge(data)).toEqual({ reference: 'R1', status: 'success', amountMinor: 5000, currency: 'GHS', channel: 'mobile_money', paidAt: '2026-10-04T10:00:00Z', userId: 'u1', product: 'pass_1m', planCode: 'PLN_m', customerCode: 'CUS_1', cardBrand: 'visa', cardLast4: '4242' })
    expect(parseCharge({ ...data, plan: 'PLN_y', metadata: { user_id: 'u2' } })).toMatchObject({ planCode: 'PLN_y', userId: 'u2', product: null })
    expect(parseCharge({ ...data, status: 'abandoned', channel: 'bank' })).toMatchObject({ status: 'pending', channel: 'other' })
    expect(parseCharge({ ...data, status: 'failed', plan: null })).toMatchObject({ status: 'failed', planCode: null })
  })
  it('verifies by reference', async () => {
    reply({ status: true, data })
    expect((await verifyTransaction('R 1')).reference).toBe('R1')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.paystack.co/transaction/verify/R%201')
  })
})

describe('disableSubscription', () => {
  it('posts the code and email token', async () => {
    reply({ status: true, message: 'ok' })
    await disableSubscription('SUB_1', 'tok')
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ code: 'SUB_1', token: 'tok' })
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/paystack.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `lib/billing/paystack.ts`

```ts
import 'server-only'
import crypto from 'node:crypto'

// Everything Paystack-specific lives here, so field-name differences are fixed in one file.

export class PaystackError extends Error {}

export type VerifiedCharge = {
  reference: string; status: 'success' | 'failed' | 'pending'; amountMinor: number; currency: string
  channel: 'mobile_money' | 'card' | 'other'; paidAt: string | null
  userId: string | null; product: string | null; planCode: string | null
  customerCode: string | null; cardBrand: string | null; cardLast4: string | null
}

export const paystackBase = () => (process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co').replace(/\/$/, '')
const secret = () => process.env.PAYSTACK_SECRET_KEY ?? ''

async function call<T>(path: string, init: { method: 'GET' | 'POST'; body?: object } = { method: 'GET' }): Promise<T> {
  const res = await fetch(`${paystackBase()}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T }
  if (!res.ok || json.status !== true) throw new PaystackError(json.message ?? `Paystack ${res.status}`)
  return json.data as T
}

export async function initializeCheckout(o: {
  email: string; amountMinor: number; callbackUrl: string; channels: ('card' | 'mobile_money')[]
  metadata: { user_id: string; product: string }; planCode?: string
}): Promise<{ url: string; reference: string }> {
  const data = await call<{ authorization_url: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: {
      email: o.email, amount: o.amountMinor, currency: 'GHS', callback_url: o.callbackUrl,
      channels: o.channels, metadata: o.metadata, ...(o.planCode ? { plan: o.planCode } : {}),
    },
  })
  return { url: data.authorization_url, reference: data.reference }
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

export function parseCharge(raw: unknown): VerifiedCharge {
  const d = (raw ?? {}) as Record<string, unknown>
  let meta = d.metadata as unknown
  if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch { meta = {} } }
  const m = (meta ?? {}) as Record<string, unknown>
  const plan = d.plan as unknown
  const planCode = typeof plan === 'string' ? str(plan) : str((plan as { plan_code?: unknown } | null)?.plan_code)
  const auth = (d.authorization ?? {}) as Record<string, unknown>
  const customer = (d.customer ?? {}) as Record<string, unknown>
  const status = d.status === 'success' ? 'success' : d.status === 'failed' ? 'failed' : 'pending'
  const channel = d.channel === 'mobile_money' ? 'mobile_money' : d.channel === 'card' ? 'card' : 'other'
  return {
    reference: String(d.reference ?? ''), status, amountMinor: Number(d.amount ?? 0), currency: String(d.currency ?? ''),
    channel, paidAt: str(d.paid_at), userId: str(m.user_id), product: str(m.product), planCode,
    customerCode: str(customer.customer_code), cardBrand: str(auth.brand), cardLast4: str(auth.last4),
  }
}

export async function verifyTransaction(reference: string): Promise<VerifiedCharge> {
  return parseCharge(await call(`/transaction/verify/${encodeURIComponent(reference)}`))
}

export async function disableSubscription(code: string, token: string): Promise<void> {
  await call('/subscription/disable', { method: 'POST', body: { code, token } })
}

export function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header || !secret()) return false
  const expected = crypto.createHmac('sha512', secret()).update(rawBody).digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(header)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/paystack.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/paystack.ts tests/unit/paystack.test.ts
git commit -m "feat: Paystack client — checkout, verify, disable, signature"
```

---

### Task 6: Crediting a verified charge

**Files:**
- Create: `lib/billing/credit.ts`, `tests/unit/billingCredit.test.ts`

**Interfaces:**
- Consumes: `VerifiedCharge`, `PRODUCTS`, `adminClient`, `apply_payment`.
- Produces:
  - `productFor(charge: VerifiedCharge): ProductId | null` — metadata product if valid; else a renewal from `planCode` (`PAYSTACK_PLAN_MONTHLY` → `renew_1m`, `PAYSTACK_PLAN_YEARLY` → `renew_12m`)
  - `creditVerifiedCharge(charge: VerifiedCharge, userId: string): Promise<{ state: 'credited' | 'pending' | 'failed' | 'needs_review'; premiumUntil: string | null }>`
  - `userForCharge(charge: VerifiedCharge): Promise<string | null>` — `charge.userId`, else the entitlement with `customer_code = charge.customerCode` (renewals have no metadata)

- [ ] **Step 1: Write the failing test** — `tests/unit/billingCredit.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VerifiedCharge } from '@/lib/billing/paystack'

const rpc = vi.fn(async (..._a: unknown[]) => ({ data: '2026-11-04T00:00:00Z', error: null }))
let customerRow: { user_id: string } | null = null
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({
  rpc: (...a: unknown[]) => rpc(...a),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: customerRow, error: null }) }) }) }),
}) }))
vi.mock('server-only', () => ({}))
import { creditVerifiedCharge, productFor, userForCharge } from '@/lib/billing/credit'

const base: VerifiedCharge = { reference: 'R1', status: 'success', amountMinor: 5000, currency: 'GHS', channel: 'mobile_money', paidAt: '2026-10-04T10:00:00Z', userId: 'u1', product: 'pass_1m', planCode: null, customerCode: 'CUS_1', cardBrand: null, cardLast4: null }
beforeEach(() => { rpc.mockClear(); customerRow = null; process.env.PAYSTACK_PLAN_MONTHLY = 'PLN_m'; process.env.PAYSTACK_PLAN_YEARLY = 'PLN_y' })
const args = () => rpc.mock.calls[0][1] as Record<string, unknown>

describe('productFor', () => {
  it('uses the product from checkout metadata, or the plan for renewals', () => {
    expect(productFor(base)).toBe('pass_1m')
    expect(productFor({ ...base, product: null, planCode: 'PLN_y' })).toBe('renew_12m')
    expect(productFor({ ...base, product: 'gold', planCode: null })).toBeNull()
  })
})

describe('creditVerifiedCharge', () => {
  it('credits a matching successful charge', async () => {
    expect(await creditVerifiedCharge(base, 'u1')).toEqual({ state: 'credited', premiumUntil: '2026-11-04T00:00:00Z' })
    expect(rpc.mock.calls[0][0]).toBe('apply_payment')
    expect(args()).toMatchObject({ p_user: 'u1', p_reference: 'R1', p_product: 'pass_1m', p_amount_minor: 5000, p_status: 'success', p_months: 1, p_channel: 'mobile_money', p_customer_code: 'CUS_1' })
  })
  it('records a wrong amount or currency as needs_review, extending nothing', async () => {
    expect((await creditVerifiedCharge({ ...base, amountMinor: 100 }, 'u1')).state).toBe('needs_review')
    expect(args()).toMatchObject({ p_status: 'needs_review', p_months: 0 })
    rpc.mockClear()
    expect((await creditVerifiedCharge({ ...base, currency: 'NGN' }, 'u1')).state).toBe('needs_review')
  })
  it('records failures and leaves pending charges alone', async () => {
    expect((await creditVerifiedCharge({ ...base, status: 'failed' }, 'u1')).state).toBe('failed')
    expect(args()).toMatchObject({ p_status: 'failed', p_months: 0 })
    rpc.mockClear()
    expect((await creditVerifiedCharge({ ...base, status: 'pending' }, 'u1')).state).toBe('pending')
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('userForCharge', () => {
  it('uses the checkout metadata, or finds a renewal\'s student by Paystack customer', async () => {
    expect(await userForCharge(base)).toBe('u1')
    customerRow = { user_id: 'u9' }
    expect(await userForCharge({ ...base, userId: null })).toBe('u9')
    customerRow = null
    expect(await userForCharge({ ...base, userId: null })).toBeNull()
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/billingCredit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `lib/billing/credit.ts`

```ts
import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { PRODUCTS, type ProductId } from './plans'
import type { VerifiedCharge } from './paystack'

export function productFor(c: VerifiedCharge): ProductId | null {
  if (c.product && c.product in PRODUCTS) return c.product as ProductId
  if (c.planCode && c.planCode === process.env.PAYSTACK_PLAN_MONTHLY) return 'renew_1m'
  if (c.planCode && c.planCode === process.env.PAYSTACK_PLAN_YEARLY) return 'renew_12m'
  return null
}

export async function userForCharge(c: VerifiedCharge): Promise<string | null> {
  if (c.userId) return c.userId
  if (!c.customerCode) return null
  const { data } = await adminClient().from('entitlements').select('user_id').eq('customer_code', c.customerCode).maybeSingle()
  return (data as { user_id: string } | null)?.user_id ?? null
}

// Record a charge Paystack has confirmed to us. Only a successful charge whose amount and currency
// match the product extends Premium; anything else is recorded (failed / needs_review) and changes
// nothing. apply_payment is idempotent by reference, so the webhook and the return page can both call this.
export async function creditVerifiedCharge(c: VerifiedCharge, userId: string): Promise<{ state: 'credited' | 'pending' | 'failed' | 'needs_review'; premiumUntil: string | null }> {
  if (c.status === 'pending') return { state: 'pending', premiumUntil: null }
  const product = productFor(c)
  const matches = !!product && c.currency === 'GHS' && c.amountMinor === PRODUCTS[product].amountMinor
  const state = c.status === 'failed' ? 'failed' : matches ? 'credited' : 'needs_review'
  const { data, error } = await adminClient().rpc('apply_payment', {
    p_user: userId, p_reference: c.reference, p_product: product ?? 'pass_1m', p_amount_minor: c.amountMinor,
    p_currency: c.currency, p_channel: c.channel, p_status: state === 'credited' ? 'success' : state,
    p_months: state === 'credited' ? PRODUCTS[product!].months : 0, p_paid_at: c.paidAt,
    p_customer_code: c.customerCode, p_card_brand: c.cardBrand, p_card_last4: c.cardLast4,
  })
  if (error) throw error
  return { state, premiumUntil: (data as string | null) ?? null }
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/billingCredit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/credit.ts tests/unit/billingCredit.test.ts
git commit -m "feat: credit verified Paystack charges, matching amount and product"
```

---

### Task 7: Checkout route

**Files:**
- Create: `app/api/billing/checkout/route.ts`, `tests/unit/billingCheckout.test.ts`

**Interfaces:**
- Consumes: `initializeCheckout`, `CHOICES`, `PRODUCTS`, `isBillingConfigured`.
- Produces: `POST /api/billing/checkout` `{ choice: '1m'|'3m'|'12m', autoRenew: boolean }` → 200 `{ url }` | 400 `bad_request` | 401 | 403 `email_unconfirmed` | 503 `billing_unavailable` | 502 `checkout_failed`.

- [ ] **Step 1: Write the failing test** — `tests/unit/billingCheckout.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: { id: string; email: string; email_confirmed_at: string | null } | null
const initializeCheckout = vi.fn(async () => ({ url: 'https://pay/x', reference: 'R1' }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }))
vi.mock('@/lib/billing/paystack', () => ({ initializeCheckout: (...a: unknown[]) => initializeCheckout(...(a as [])) }))
vi.mock('@/lib/supabase/admin', () => ({ isBillingConfigured: () => !!process.env.PAYSTACK_SECRET_KEY }))
import { POST } from '@/app/api/billing/checkout/route'

const call = (body: object) => POST(new Request('https://studyhub.test/api/billing/checkout', { method: 'POST', body: JSON.stringify(body) }))
const sent = () => (initializeCheckout.mock.calls[0] as unknown as [Record<string, unknown>])[0]
beforeEach(() => {
  user = { id: 'u1', email: 'ama@example.com', email_confirmed_at: '2026-10-01T00:00:00Z' }
  initializeCheckout.mockClear(); process.env.PAYSTACK_SECRET_KEY = 'sk'; process.env.PAYSTACK_PLAN_MONTHLY = 'PLN_m'; process.env.PAYSTACK_PLAN_YEARLY = 'PLN_y'
})

describe('POST /api/billing/checkout', () => {
  it('starts a pass that MoMo or card can pay, returning to /plans/return', async () => {
    const res = await call({ choice: '3m', autoRenew: false })
    expect(await res.json()).toEqual({ url: 'https://pay/x' })
    expect(sent()).toMatchObject({ email: 'ama@example.com', amountMinor: 13500, channels: ['card', 'mobile_money'], callbackUrl: 'https://studyhub.test/plans/return', metadata: { user_id: 'u1', product: 'pass_3m' } })
    expect(sent().planCode).toBeUndefined()
  })
  it('auto-renew is card only and uses the Paystack plan', async () => {
    await call({ choice: '12m', autoRenew: true })
    expect(sent()).toMatchObject({ amountMinor: 48000, channels: ['card'], planCode: 'PLN_y', metadata: { product: 'renew_12m' } })
  })
  it('refuses auto-renew for 3 months, unknown choices, signed-out and unconfirmed students', async () => {
    expect((await call({ choice: '3m', autoRenew: true })).status).toBe(400)
    expect((await call({ choice: '6m', autoRenew: false })).status).toBe(400)
    user = { id: 'u1', email: 'a@b.c', email_confirmed_at: null }
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(403)
    user = null
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(401)
    expect(initializeCheckout).not.toHaveBeenCalled()
  })
  it('says billing is unavailable without Paystack keys, and reports Paystack failures', async () => {
    delete process.env.PAYSTACK_SECRET_KEY
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(503)
    process.env.PAYSTACK_SECRET_KEY = 'sk'
    initializeCheckout.mockRejectedValueOnce(new Error('down'))
    expect((await call({ choice: '1m', autoRenew: false })).status).toBe(502)
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/billingCheckout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `app/api/billing/checkout/route.ts`

```ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { isBillingConfigured } from '@/lib/supabase/admin'
import { initializeCheckout } from '@/lib/billing/paystack'
import { CHOICES, PRODUCTS, type CheckoutChoice } from '@/lib/billing/plans'

const err = (status: number, error: string) => NextResponse.json({ error }, { status })

// POST { choice, autoRenew } → { url } of the Paystack checkout page
export async function POST(request: Request) {
  if (!isBillingConfigured()) return err(503, 'billing_unavailable')
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return err(401, 'unauthorized')
  if (!user.email || !user.email_confirmed_at) return err(403, 'email_unconfirmed')
  const body = (await request.json().catch(() => null)) as { choice?: unknown; autoRenew?: unknown } | null
  const choice = CHOICES[body?.choice as CheckoutChoice]
  const autoRenew = body?.autoRenew === true
  if (!choice || (autoRenew && !choice.renew)) return err(400, 'bad_request')

  const product = autoRenew ? choice.renew! : choice.pass
  const planCode = autoRenew ? (product === 'renew_1m' ? process.env.PAYSTACK_PLAN_MONTHLY : process.env.PAYSTACK_PLAN_YEARLY) : undefined
  if (autoRenew && !planCode) return err(503, 'billing_unavailable')
  try {
    const { url } = await initializeCheckout({
      email: user.email, amountMinor: PRODUCTS[product].amountMinor,
      callbackUrl: `${new URL(request.url).origin}/plans/return`,
      // Auto-renew charges a saved card; MoMo needs approval each time, so it's for passes
      channels: autoRenew ? ['card'] : ['card', 'mobile_money'],
      metadata: { user_id: user.id, product }, ...(planCode ? { planCode } : {}),
    })
    return NextResponse.json({ url })
  } catch {
    return err(502, 'checkout_failed')
  }
}
```
(Google sign-ins have `email_confirmed_at` set by Supabase.)

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/billingCheckout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/billing/checkout/route.ts tests/unit/billingCheckout.test.ts
git commit -m "feat: start a Paystack checkout for a pass or auto-renew"
```

---

### Task 8: Webhook route

**Files:**
- Create: `app/api/billing/webhook/route.ts`, `tests/unit/billingWebhook.test.ts`

**Interfaces:**
- Consumes: `verifySignature`, `verifyTransaction`, `parseCharge`, `creditVerifiedCharge`, `userForCharge`, `adminClient`, `set_subscription`, `apply_refund`, `billing_events`.
- Produces: `POST /api/billing/webhook` — 401 on a bad signature; otherwise 200 `{ ok: true }` (also for duplicates and ignored events) or 500 when processing failed (so Paystack retries).

- [ ] **Step 1: Write the failing test** — `tests/unit/billingWebhook.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

const events = new Set<string>()
const rpc = vi.fn(async (..._a: unknown[]) => ({ data: null, error: null }))
let customerUser: string | null = 'u1'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({
  rpc: (...a: unknown[]) => rpc(...a),
  from: (t: string) => t === 'billing_events'
    ? { insert: async (row: { id: string }) => (events.has(row.id) ? { error: { code: '23505' } } : (events.add(row.id), { error: null })),
        delete: () => ({ eq: async (_c: string, id: string) => { events.delete(id); return { error: null } } }) }
    : { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: customerUser ? { user_id: customerUser } : null }) }) }) },
}) }))
const verifyTransaction = vi.fn()
const creditVerifiedCharge = vi.fn(async () => ({ state: 'credited', premiumUntil: 'x' }))
vi.mock('@/lib/billing/credit', async () => ({
  creditVerifiedCharge: (...a: unknown[]) => creditVerifiedCharge(...(a as [])),
  userForCharge: async (c: { userId: string | null }) => c.userId ?? customerUser,
}))
vi.mock('@/lib/billing/paystack', async orig => ({ ...(await orig<typeof import('@/lib/billing/paystack')>()), verifyTransaction: (r: string) => verifyTransaction(r) }))
import { POST } from '@/app/api/billing/webhook/route'

const sign = (body: string) => crypto.createHmac('sha512', 'sk_test').update(body).digest('hex')
const send = (payload: object, signature?: string) => {
  const body = JSON.stringify(payload)
  return POST(new Request('https://x/api/billing/webhook', { method: 'POST', body, headers: { 'x-paystack-signature': signature ?? sign(body) } }))
}
const charge = { reference: 'R1', status: 'success', amount: 5000, currency: 'GHS', channel: 'card', metadata: { user_id: 'u1', product: 'pass_1m' } }
beforeEach(() => {
  events.clear(); rpc.mockClear(); creditVerifiedCharge.mockClear(); verifyTransaction.mockReset(); customerUser = 'u1'
  process.env.PAYSTACK_SECRET_KEY = 'sk_test'
  verifyTransaction.mockResolvedValue({ reference: 'R1', status: 'success', amountMinor: 5000, currency: 'GHS', channel: 'card', paidAt: null, userId: 'u1', product: 'pass_1m', planCode: null, customerCode: 'CUS_1', cardBrand: null, cardLast4: null })
})

describe('POST /api/billing/webhook', () => {
  it('rejects a bad or missing signature and credits nothing', async () => {
    expect((await send({ event: 'charge.success', data: charge }, 'forged')).status).toBe(401)
    expect(creditVerifiedCharge).not.toHaveBeenCalled()
  })
  it('re-verifies a charge with Paystack before crediting it (never trusts the body)', async () => {
    const res = await send({ event: 'charge.success', data: { ...charge, amount: 1 } })
    expect(res.status).toBe(200)
    expect(verifyTransaction).toHaveBeenCalledWith('R1')
    expect((creditVerifiedCharge.mock.calls[0] as unknown[])[0]).toMatchObject({ amountMinor: 5000 })
    expect((creditVerifiedCharge.mock.calls[0] as unknown[])[1]).toBe('u1')
  })
  it('handles the same event only once', async () => {
    await send({ event: 'charge.success', data: charge })
    await send({ event: 'charge.success', data: charge })
    expect(creditVerifiedCharge).toHaveBeenCalledTimes(1)
  })
  it('records subscriptions and their cancellation', async () => {
    await send({ event: 'subscription.create', data: { subscription_code: 'SUB_1', email_token: 'tok', customer: { customer_code: 'CUS_1' }, plan: { plan_code: 'PLN_m' } } })
    expect(rpc).toHaveBeenLastCalledWith('set_subscription', { p_user: 'u1', p_subscription_code: 'SUB_1', p_email_token: 'tok', p_auto_renew: true })
    await send({ event: 'subscription.not_renew', data: { subscription_code: 'SUB_1', customer: { customer_code: 'CUS_1' } } })
    expect(rpc).toHaveBeenLastCalledWith('set_subscription', { p_user: 'u1', p_subscription_code: 'SUB_1', p_email_token: null, p_auto_renew: false })
  })
  it('applies refunds by transaction reference', async () => {
    await send({ event: 'refund.processed', data: { id: 9, transaction_reference: 'R1' } })
    expect(rpc).toHaveBeenLastCalledWith('apply_refund', { p_reference: 'R1' })
  })
  it('returns 500 (so Paystack retries) and forgets the event when processing fails', async () => {
    creditVerifiedCharge.mockRejectedValueOnce(new Error('db down'))
    expect((await send({ event: 'charge.success', data: charge })).status).toBe(500)
    expect((await send({ event: 'charge.success', data: charge })).status).toBe(200)
    expect(creditVerifiedCharge).toHaveBeenCalledTimes(2)
  })
  it('ignores events it does not use', async () => {
    expect((await send({ event: 'transfer.success', data: { id: 1 } })).status).toBe(200)
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/billingWebhook.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `app/api/billing/webhook/route.ts`

```ts
import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifySignature, verifyTransaction } from '@/lib/billing/paystack'
import { creditVerifiedCharge, userForCharge } from '@/lib/billing/credit'

type Payload = { event?: string; data?: Record<string, unknown> }
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

// Paystack notifications. Signed with HMAC-SHA512 of the raw body; every charge is re-verified with
// Paystack before crediting; each event is handled once (billing_events).
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifySignature(raw, request.headers.get('x-paystack-signature'))) return NextResponse.json({ error: 'bad_signature' }, { status: 401 })
  const { event, data = {} } = (JSON.parse(raw) as Payload)
  const handled = ['charge.success', 'subscription.create', 'subscription.disable', 'subscription.not_renew', 'refund.processed']
  if (!event || !handled.includes(event)) return NextResponse.json({ ok: true })

  const key = `${event}:${str(data.reference) ?? str(data.subscription_code) ?? String(data.id ?? '')}`
  const admin = adminClient()
  const { error: dup } = await admin.from('billing_events').insert({ id: key, provider: 'paystack', type: event })
  if (dup) return NextResponse.json({ ok: true }) // already handled

  try {
    if (event === 'charge.success') {
      const charge = await verifyTransaction(String(data.reference))
      const userId = await userForCharge(charge)
      if (userId) await creditVerifiedCharge(charge, userId)
    } else if (event === 'refund.processed') {
      const reference = str(data.transaction_reference) ?? str((data.transaction as Record<string, unknown> | undefined)?.reference)
      if (reference) await admin.rpc('apply_refund', { p_reference: reference })
    } else {
      const customer = str((data.customer as Record<string, unknown> | undefined)?.customer_code)
      const userId = await userForCharge({ userId: null, customerCode: customer } as never)
      if (userId) await admin.rpc('set_subscription', {
        p_user: userId, p_subscription_code: str(data.subscription_code),
        p_email_token: event === 'subscription.create' ? str(data.email_token) : null,
        p_auto_renew: event === 'subscription.create',
      })
    }
    return NextResponse.json({ ok: true })
  } catch {
    await admin.from('billing_events').delete().eq('id', key) // let Paystack's retry try again
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/billingWebhook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/billing/webhook/route.ts tests/unit/billingWebhook.test.ts
git commit -m "feat: Paystack webhook — verified, idempotent crediting, subscriptions and refunds"
```

---

### Task 9: Confirm route (the return page's check)

**Files:**
- Create: `app/api/billing/confirm/route.ts`, `tests/unit/billingConfirm.test.ts`

**Interfaces:**
- Consumes: `verifyTransaction`, `creditVerifiedCharge`.
- Produces: `GET /api/billing/confirm?reference=R` → 200 `{ state: 'credited' | 'pending' | 'failed' | 'needs_review', premiumUntil: string | null }` | 400 | 401 | 403 `not_yours` | 502.

- [ ] **Step 1: Write the failing test** — `tests/unit/billingConfirm.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: { id: string } | null = { id: 'u1' }
const verifyTransaction = vi.fn()
const creditVerifiedCharge = vi.fn(async () => ({ state: 'credited', premiumUntil: '2026-11-04T00:00:00Z' }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }))
vi.mock('@/lib/billing/paystack', () => ({ verifyTransaction: (r: string) => verifyTransaction(r) }))
vi.mock('@/lib/billing/credit', () => ({ creditVerifiedCharge: (...a: unknown[]) => creditVerifiedCharge(...(a as [])) }))
import { GET } from '@/app/api/billing/confirm/route'

const call = (ref = 'R1') => GET(new Request(`https://x/api/billing/confirm?reference=${ref}`))
const charge = (over = {}) => ({ reference: 'R1', status: 'success', userId: 'u1', ...over })
beforeEach(() => { user = { id: 'u1' }; verifyTransaction.mockReset(); creditVerifiedCharge.mockClear() })

describe('GET /api/billing/confirm', () => {
  it('verifies with Paystack and credits the student\'s own payment', async () => {
    verifyTransaction.mockResolvedValue(charge())
    expect(await (await call()).json()).toEqual({ state: 'credited', premiumUntil: '2026-11-04T00:00:00Z' })
    expect((creditVerifiedCharge.mock.calls[0] as unknown[])[1]).toBe('u1')
  })
  it('reports a pending MoMo payment as pending, not failed', async () => {
    verifyTransaction.mockResolvedValue(charge({ status: 'pending' }))
    creditVerifiedCharge.mockResolvedValueOnce({ state: 'pending', premiumUntil: null })
    expect(await (await call()).json()).toEqual({ state: 'pending', premiumUntil: null })
  })
  it('refuses another student\'s reference', async () => {
    verifyTransaction.mockResolvedValue(charge({ userId: 'u2' }))
    expect((await call()).status).toBe(403)
    expect(creditVerifiedCharge).not.toHaveBeenCalled()
  })
  it('needs a signed-in student and a reference; reports Paystack errors', async () => {
    expect((await call('')).status).toBe(400)
    verifyTransaction.mockRejectedValueOnce(new Error('down'))
    expect((await call()).status).toBe(502)
    user = null
    expect((await call()).status).toBe(401)
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/billingConfirm.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `app/api/billing/confirm/route.ts`

```ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { verifyTransaction } from '@/lib/billing/paystack'
import { creditVerifiedCharge } from '@/lib/billing/credit'

const err = (status: number, error: string) => NextResponse.json({ error }, { status })

// After Paystack sends the student back: verify the payment ourselves and credit it now (the same
// idempotent path as the webhook), so Premium shows straight away even if the webhook is slow.
export async function GET(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return err(401, 'unauthorized')
  const reference = new URL(request.url).searchParams.get('reference')?.trim()
  if (!reference) return err(400, 'bad_request')
  try {
    const charge = await verifyTransaction(reference)
    if (charge.userId !== user.id) return err(403, 'not_yours')
    return NextResponse.json(await creditVerifiedCharge(charge, user.id))
  } catch {
    return err(502, 'confirm_failed')
  }
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/billingConfirm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/billing/confirm/route.ts tests/unit/billingConfirm.test.ts
git commit -m "feat: confirm a payment on return from Paystack"
```

---

### Task 10: Turn off auto-renew

**Files:**
- Create: `app/api/billing/cancel-renewal/route.ts`, `tests/unit/billingCancel.test.ts`

**Interfaces:**
- Consumes: `disableSubscription`, `adminClient`, `set_subscription`.
- Produces: `POST /api/billing/cancel-renewal` → 200 `{ ok: true }` | 401 | 404 `no_subscription` | 502 `cancel_failed`.

- [ ] **Step 1: Write the failing test** — `tests/unit/billingCancel.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: { id: string } | null = { id: 'u1' }
let ent: { subscription_code: string | null; email_token: string | null; auto_renew: boolean } | null
const disableSubscription = vi.fn(async () => {})
const rpc = vi.fn(async () => ({ error: null }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({
  rpc: (...a: unknown[]) => rpc(...(a as [])),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ent }) }) }) }),
}) }))
vi.mock('@/lib/billing/paystack', () => ({ disableSubscription: (...a: unknown[]) => disableSubscription(...(a as [])) }))
import { POST } from '@/app/api/billing/cancel-renewal/route'

const call = () => POST(new Request('https://x', { method: 'POST' }))
beforeEach(() => { user = { id: 'u1' }; ent = { subscription_code: 'SUB_1', email_token: 'tok', auto_renew: true }; disableSubscription.mockClear(); rpc.mockClear() })

describe('POST /api/billing/cancel-renewal', () => {
  it('disables the Paystack subscription and records auto-renew off', async () => {
    expect((await call()).status).toBe(200)
    expect(disableSubscription).toHaveBeenCalledWith('SUB_1', 'tok')
    expect(rpc).toHaveBeenCalledWith('set_subscription', { p_user: 'u1', p_subscription_code: null, p_email_token: null, p_auto_renew: false })
  })
  it('404s without a subscription, 502s when Paystack fails (renewal stays on), 401s signed out', async () => {
    disableSubscription.mockRejectedValueOnce(new Error('down'))
    expect((await call()).status).toBe(502)
    expect(rpc).not.toHaveBeenCalled()
    ent = { subscription_code: null, email_token: null, auto_renew: false }
    expect((await call()).status).toBe(404)
    user = null
    expect((await call()).status).toBe(401)
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/billingCancel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `app/api/billing/cancel-renewal/route.ts`

```ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { disableSubscription } from '@/lib/billing/paystack'

// Turn off auto-renew: Premium continues to the end of the paid period
export async function POST() {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = adminClient()
  const { data: ent } = await admin.from('entitlements').select('subscription_code,email_token,auto_renew').eq('user_id', user.id).maybeSingle()
  const e = ent as { subscription_code: string | null; email_token: string | null } | null
  if (!e?.subscription_code || !e.email_token) return NextResponse.json({ error: 'no_subscription' }, { status: 404 })
  try {
    await disableSubscription(e.subscription_code, e.email_token)
  } catch {
    return NextResponse.json({ error: 'cancel_failed' }, { status: 502 })
  }
  await admin.rpc('set_subscription', { p_user: user.id, p_subscription_code: null, p_email_token: null, p_auto_renew: false })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/billingCancel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/billing/cancel-renewal/route.ts tests/unit/billingCancel.test.ts
git commit -m "feat: turn off Premium auto-renew"
```

---

### Task 11: Plans page and return page

**Files:**
- Create: `app/(app)/plans/page.tsx`, `app/(app)/plans/return/page.tsx`, `components/billing/PlanPicker.tsx`, `components/billing/ReturnStatus.tsx`, `tests/unit/plansPages.test.tsx`

**Interfaces:**
- Consumes: `/api/billing/checkout`, `/api/billing/confirm`, `CHOICES`, `PRODUCTS`, `formatGhs`, `usePlan`, `announcePlanChanged`.
- Produces: `<PlanPicker go={(url: string) => void} />` (default `go` = `window.location.assign`); `<ReturnStatus reference={string} pollMs? maxMs? />`.

- [ ] **Step 1: Write the failing test** — `tests/unit/plansPages.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null }), gte: async () => ({ data: [] }) }) }) }) }))
import { PlanPicker } from '@/components/billing/PlanPicker'
import { ReturnStatus } from '@/components/billing/ReturnStatus'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('PlanPicker', () => {
  it('shows Free and Premium with the three options and sends the student to Paystack', async () => {
    fetchMock.mockImplementation(() => json({ url: 'https://pay/x' }))
    const go = vi.fn()
    render(<PlanPicker go={go} />)
    expect(screen.getByText('GHS 135')).toBeTruthy()
    expect(screen.getByText('save 20%')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /1 year/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Renew automatically (card only)' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay GHS 480 with Paystack' })) })
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ choice: '12m', autoRenew: true })
    expect(go).toHaveBeenCalledWith('https://pay/x')
  })
  it('disables auto-renew for 3 months', () => {
    render(<PlanPicker go={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: /3 months/ }))
    expect((screen.getByRole('checkbox', { name: 'Renew automatically (card only)' }) as HTMLInputElement).disabled).toBe(true)
  })
  it('explains a checkout that could not start', async () => {
    fetchMock.mockImplementation(() => json({ error: 'checkout_failed' }, 502))
    render(<PlanPicker go={() => {}} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay GHS 50 with Paystack' })) })
    expect(screen.getByRole('alert').textContent).toBe('Couldn\'t start checkout. Try again.')
  })
})

describe('ReturnStatus', () => {
  it('shows Premium as soon as the payment is confirmed', async () => {
    fetchMock.mockImplementation(() => json({ state: 'credited', premiumUntil: '2026-12-03T10:00:00Z' }))
    render(<ReturnStatus reference="R1" />)
    expect(await screen.findByText(/You're on Premium until 3 Dec 2026/)).toBeTruthy()
  })
  it('keeps checking a pending payment, then says it will switch on later', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fetchMock.mockImplementation(() => json({ state: 'pending', premiumUntil: null }))
    render(<ReturnStatus reference="R1" pollMs={1000} maxMs={3000} />)
    expect(screen.getByText('Confirming your payment…')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/We'll switch you to Premium as soon as Paystack confirms/)).toBeTruthy()
  })
  it('says a failed payment did not go through', async () => {
    fetchMock.mockImplementation(() => json({ state: 'failed', premiumUntil: null }))
    render(<ReturnStatus reference="R1" />)
    expect(await screen.findByText('Payment didn\'t go through. You haven\'t been charged.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Try again' }).getAttribute('href')).toBe('/plans')
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/plansPages.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement** — `components/billing/PlanPicker.tsx`

```tsx
'use client'
import { useState } from 'react'
import { CHOICES, FAIR_USE_MONTHLY_ACTIONS, FAIR_USE_TRANSCRIPT_HOURS, FREE_DAILY_ACTIONS, PRODUCTS, formatGhs, type CheckoutChoice } from '@/lib/billing/plans'

const ORDER: CheckoutChoice[] = ['1m', '3m', '12m']

export function PlanPicker({ go = url => window.location.assign(url) }: { go?: (url: string) => void }) {
  const [choice, setChoice] = useState<CheckoutChoice>('1m')
  const [autoRenew, setAutoRenew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canRenew = !!CHOICES[choice].renew
  const price = PRODUCTS[CHOICES[choice].pass].amountMinor

  async function pay() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice, autoRenew: canRenew && autoRenew }) })
      const body = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (res.ok && body.url) { go(body.url); return }
      setError(body.error === 'email_unconfirmed' ? 'Confirm your email address first, then try again.' : 'Couldn\'t start checkout. Try again.')
    } catch { setError('Couldn\'t start checkout. Try again.') }
    setBusy(false)
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1.3fr]">
      <section className="card">
        <h2 className="font-semibold">Free</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Every feature</li><li>{FREE_DAILY_ACTIONS} AI actions a day</li><li>Free live lecture transcripts</li>
        </ul>
      </section>
      <section className="card border-2 border-accent">
        <h2 className="font-semibold">✦ Premium</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li>Unlimited AI*</li><li>Accurate lecture transcripts</li></ul>
        <fieldset className="mt-3 space-y-1.5 text-sm"><legend className="sr-only">Length</legend>
          {ORDER.map(c => (
            <label key={c} className="flex items-center gap-2">
              <input type="radio" name="choice" checked={choice === c} onChange={() => setChoice(c)} />
              {PRODUCTS[CHOICES[c].pass].label} · <b>{formatGhs(PRODUCTS[CHOICES[c].pass].amountMinor)}</b>
              {CHOICES[c].save && <span className="text-success">{CHOICES[c].save}</span>}
            </label>
          ))}
        </fieldset>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={canRenew && autoRenew} disabled={!canRenew} onChange={e => setAutoRenew(e.target.checked)} />
          Renew automatically (card only)
        </label>
        <button type="button" className="btn-primary mt-3" disabled={busy} onClick={pay}>{busy ? 'Opening Paystack…' : `Pay ${formatGhs(price)} with Paystack`}</button>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">MoMo or card. *Fair use: {FAIR_USE_MONTHLY_ACTIONS} AI actions &amp; {FAIR_USE_TRANSCRIPT_HOURS} h transcripts a month.</p>
      </section>
    </div>
  )
}
```

`components/billing/ReturnStatus.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { announcePlanChanged } from './usePlan'

type State = 'checking' | 'credited' | 'pending' | 'failed' | 'error'
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Polls our confirm endpoint (which verifies with Paystack) until the payment settles or maxMs passes
export function ReturnStatus({ reference, pollMs = 3000, maxMs = 60_000 }: { reference: string; pollMs?: number; maxMs?: number }) {
  const [state, setState] = useState<State>('checking')
  const [until, setUntil] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()
    async function check() {
      try {
        const res = await fetch(`/api/billing/confirm?reference=${encodeURIComponent(reference)}`)
        const body = await res.json() as { state?: string; premiumUntil?: string | null }
        if (!live) return
        if (res.ok && body.state === 'credited') { setUntil(body.premiumUntil ?? null); setState('credited'); announcePlanChanged(); return }
        if (res.ok && body.state === 'failed') { setState('failed'); return }
        if (!res.ok && res.status !== 502) { setState('error'); return }
      } catch { /* keep trying */ }
      if (Date.now() - started + pollMs > maxMs) { setState('pending'); return }
      timer = setTimeout(check, pollMs)
    }
    check()
    return () => { live = false; clearTimeout(timer) }
  }, [reference, pollMs, maxMs])

  if (state === 'checking') return <p role="status">Confirming your payment…</p>
  if (state === 'credited') return <p role="status" className="text-lg font-medium">You&apos;re on Premium{until ? ` until ${fmt(until)}` : ''}. ✦</p>
  if (state === 'pending') return <p role="status">We&apos;ll switch you to Premium as soon as Paystack confirms. You can keep using Studyhub.</p>
  return (
    <div role="status" className="space-y-2">
      <p>{state === 'failed' ? 'Payment didn\'t go through. You haven\'t been charged.' : 'We couldn\'t check this payment. If you paid, Premium will switch on shortly.'}</p>
      <Link href="/plans" className="btn">Try again</Link>
    </div>
  )
}
```
(`needs_review` comes back as an `ok` response that isn't credited/failed, so it keeps polling and ends at the "pending" message — correct: someone must look at it.)

`app/(app)/plans/page.tsx`

```tsx
import { PageHeader } from '@/components/ui/PageHeader'
import { PlanPicker } from '@/components/billing/PlanPicker'

export default function PlansPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Plans" />
      <PlanPicker />
    </div>
  )
}
```

`app/(app)/plans/return/page.tsx`

```tsx
import { PageHeader } from '@/components/ui/PageHeader'
import { ReturnStatus } from '@/components/billing/ReturnStatus'

export default async function ReturnPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const p = await searchParams
  const reference = p.reference ?? p.trxref ?? ''
  return (
    <div className="max-w-xl space-y-5">
      <PageHeader title="Premium" />
      <div className="card">{reference ? <ReturnStatus reference={reference} /> : <p>We couldn&apos;t find that payment.</p>}</div>
    </div>
  )
}
```
(Check `PageHeader`'s props in `components/ui/PageHeader.tsx` and match them. Paystack appends `reference` and `trxref` to the callback URL.)

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/plansPages.test.tsx` then `npx tsc --noEmit -p .` and `npx eslint .`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add components/billing "app/(app)/plans" tests/unit/plansPages.test.tsx
git commit -m "feat: plans page and payment return page"
```

---

### Task 12: Settings → Plan, sidebar badge, ending banner

**Files:**
- Create: `components/settings/PlanCard.tsx`, `components/billing/PremiumBadge.tsx`, `components/billing/EndingBanner.tsx`, `tests/unit/planCard.test.tsx`
- Modify: `app/(app)/settings/page.tsx` (render `<PlanCard />` above `<AppearanceCard />`), `components/shell/AppShell.tsx` (badge beside the "Studyhub" brand; banner at the top of `<main>` when not immersive)

**Interfaces:**
- Consumes: `usePlan`, `payments` (readable by the student), `/api/billing/cancel-renewal`, `announcePlanChanged`, `PRODUCTS`, `formatGhs`, `FAIR_USE_MONTHLY_ACTIONS`.
- Produces: `<PlanCard />`, `<PremiumBadge />`, `<EndingBanner now?: Date />`, `endingSoon(plan, now): { days: number; date: string } | null` (Premium, no auto-renew, ends within 7 days).

- [ ] **Step 1: Write the failing test** — `tests/unit/planCard.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

let ent: Record<string, unknown> | null
let payments: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({
  from: (t: string) => t === 'entitlements'
    ? { select: () => ({ maybeSingle: async () => ({ data: ent }) }) }
    : t === 'payments'
      ? { select: () => ({ order: () => ({ limit: async () => ({ data: payments }) }) }) }
      : { select: () => ({ gte: async () => ({ data: [{ cost: 112, at: new Date().toISOString() }] }) }) },
}) }))
import { PlanCard } from '@/components/settings/PlanCard'
import { endingSoon } from '@/components/billing/EndingBanner'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  ent = { premium_until: '2026-12-03T10:00:00Z', auto_renew: true, card_brand: 'visa', card_last4: '4242' }
  payments = [{ id: 'p1', product: 'pass_1m', amount_minor: 5000, channel: 'mobile_money', status: 'success', paid_at: '2026-10-03T10:00:00Z', created_at: '2026-10-03T10:00:00Z' }]
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete process.env.NEXT_PUBLIC_BILLING_ENABLED })
const renderCard = () => render(<ConfirmProvider><PlanCard /></ConfirmProvider>)

describe('PlanCard', () => {
  it('shows Premium, renewal, fair-use usage and payment history', async () => {
    renderCard()
    expect(await screen.findByText('✦ Premium')).toBeTruthy()
    expect(screen.getByText(/until 3 Dec 2026/)).toBeTruthy()
    expect(screen.getByText(/Renews automatically \(Visa •• 4242\)/)).toBeTruthy()
    expect(screen.getByText('This month: 112 of 400 AI actions')).toBeTruthy()
    expect(screen.getByText(/3 Oct 2026 · 1 month · GHS 50 · MoMo/)).toBeTruthy()
  })
  it('turns off renewal after confirming', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    renderCard()
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Turn off renewal' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn off' })) })
    expect(fetchMock).toHaveBeenCalledWith('/api/billing/cancel-renewal', { method: 'POST' })
  })
  it('shows Free with a Get Premium link when there is no plan', async () => {
    ent = null; payments = []
    renderCard()
    expect(await screen.findByText('Free')).toBeTruthy()
    expect(screen.getByRole('link', { name: '✦ Get Premium' }).getAttribute('href')).toBe('/plans')
  })
})

describe('endingSoon', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  it('warns within 7 days for a pass, not with auto-renew or when far off', () => {
    expect(endingSoon({ isPremium: true, autoRenew: false, premiumUntil: new Date('2026-10-09T12:00:00Z') }, now)).toEqual({ days: 5, date: '9 Oct' })
    expect(endingSoon({ isPremium: true, autoRenew: true, premiumUntil: new Date('2026-10-09T12:00:00Z') }, now)).toBeNull()
    expect(endingSoon({ isPremium: true, autoRenew: false, premiumUntil: new Date('2026-10-20T12:00:00Z') }, now)).toBeNull()
    expect(endingSoon({ isPremium: false, autoRenew: false, premiumUntil: null }, now)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/planCard.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement** — `components/billing/EndingBanner.tsx`

```tsx
'use client'
import Link from 'next/link'
import { usePlan } from './usePlan'

export function endingSoon(p: { isPremium: boolean; autoRenew: boolean; premiumUntil: Date | null }, now: Date) {
  if (!p.isPremium || p.autoRenew || !p.premiumUntil) return null
  const days = Math.ceil((p.premiumUntil.getTime() - now.getTime()) / 86_400_000)
  if (days > 7) return null
  return { days, date: p.premiumUntil.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) }
}

export function EndingBanner() {
  const plan = usePlan()
  const soon = plan.billing ? endingSoon(plan, new Date()) : null
  if (!soon) return null
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
      <span>Premium ends on {soon.date}.</span>
      <Link href="/plans" className="font-medium text-accent">Renew</Link>
    </div>
  )
}
```

`components/billing/PremiumBadge.tsx`

```tsx
'use client'
import { usePlan } from './usePlan'

export function PremiumBadge() {
  const plan = usePlan()
  if (!plan.billing || !plan.isPremium) return null
  return <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent" title="Premium">✦ Premium</span>
}
```

`components/settings/PlanCard.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { announcePlanChanged, usePlan } from '@/components/billing/usePlan'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { FAIR_USE_MONTHLY_ACTIONS, PRODUCTS, formatGhs, type ProductId } from '@/lib/billing/plans'

type Payment = { id: string; product: ProductId; amount_minor: number; channel: string; status: string; paid_at: string | null; created_at: string }
const date = (iso: string, withYear = true) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
const CHANNEL: Record<string, string> = { mobile_money: 'MoMo', card: 'Card', other: 'Other' }
const STATUS: Record<string, string> = { success: '✓', failed: 'failed', refunded: 'refunded', needs_review: 'being checked' }

export function PlanCard() {
  const plan = usePlan()
  const confirm = useConfirm()
  const [payments, setPayments] = useState<Payment[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase().from('payments').select('id,product,amount_minor,channel,status,paid_at,created_at').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setPayments((data ?? []) as Payment[]))
  }, [])
  if (!plan.billing || plan.loading) return null

  async function cancel() {
    if (!await confirm({ title: 'Turn off renewal?', body: `Premium stays on until ${date(plan.premiumUntil!.toISOString())}, then you'll be on Free.`, confirmLabel: 'Turn off' })) return
    const res = await fetch('/api/billing/cancel-renewal', { method: 'POST' })
    if (res.ok) announcePlanChanged()
    else setError('Couldn\'t turn off renewal. Try again or contact support.')
  }

  return (
    <section className="card space-y-3">
      <h2 className="text-base font-semibold">Plan</h2>
      {plan.isPremium ? (
        <div className="space-y-1 text-sm">
          <p><b>✦ Premium</b> <span className="text-muted">until {date(plan.premiumUntil!.toISOString())}</span></p>
          {plan.autoRenew
            ? <p className="text-muted">Renews automatically{plan.cardLabel ? ` (${plan.cardLabel})` : ''} · <button type="button" className="text-danger" onClick={cancel}>Turn off renewal</button></p>
            : <p className="text-muted">Ends on {date(plan.premiumUntil!.toISOString())}</p>}
          <p>This month: {plan.usedThisMonth} of {FAIR_USE_MONTHLY_ACTIONS} AI actions</p>
          <Link href="/plans" className="btn mt-1">Add more time</Link>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p><b>Free</b></p>
          <Link href="/plans" className="btn-primary">✦ Get Premium</Link>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {payments.length > 0 && (
        <div>
          <h3 className="section-label">Payments</h3>
          <ul className="space-y-0.5 text-sm text-muted">
            {payments.map(p => (
              <li key={p.id}>{date(p.paid_at ?? p.created_at)} · {PRODUCTS[p.product]?.label.replace(' (renewal)', '') ?? p.product} · {formatGhs(p.amount_minor)} · {CHANNEL[p.channel] ?? p.channel} {STATUS[p.status] ?? p.status}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
```

`app/(app)/settings/page.tsx`: import `PlanCard` and render `<PlanCard />` directly above `<AppearanceCard />`.
`components/shell/AppShell.tsx`: render `<PremiumBadge />` immediately after the "Studyhub" brand text in the sidebar header, and `{!immersive && <EndingBanner />}` as the first child of `<main>`.

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run tests/unit/planCard.test.tsx` then `npm test`, `npx tsc --noEmit -p .`, `npx eslint .`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add components/settings/PlanCard.tsx components/billing "app/(app)/settings/page.tsx" components/shell/AppShell.tsx tests/unit/planCard.test.tsx
git commit -m "feat: Settings plan card, Premium badge and ending-soon banner"
```

---

### Task 13: End-to-end with a fake Paystack

**Files:**
- Create: `lib/billing/fakePaystackStore.ts`, `app/api/test-paystack/[...path]/route.ts`, `app/api/test-openai/burn-free/route.ts`, `e2e/billing.spec.ts`, `tests/unit/fakePaystack.test.ts`
- Modify: `playwright.config.ts` (env), `app/api/test-openai/flood/route.ts` (use `ai_check`), `e2e/study.spec.ts` (speed-limit test unchanged in behaviour)

**Interfaces:**
- Consumes: the real checkout/webhook/confirm/cancel routes; `PAYSTACK_BASE_URL` points the client at the fake.
- Produces: fake Paystack at `/api/test-paystack/*` (404 unless `E2E_FAKE_PAYSTACK === '1'` and not production): `POST transaction/initialize`, `GET transaction/verify/:ref`, `POST subscription/disable`, `GET pay?reference=…&outcome=success|fail|pending` (simulates the student paying: marks the transaction, sends a signed `charge.success` webhook to `/api/billing/webhook` for success, then redirects to the callback URL with `?reference=`).
  `POST /api/test-paystack/confirm-later?reference=…` marks a pending transaction successful and sends its webhook.

- [ ] **Step 1: Write the failing guard test** — `tests/unit/fakePaystack.test.ts`

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { POST, GET } from '@/app/api/test-paystack/[...path]/route'

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) })
afterEach(() => { delete process.env.E2E_FAKE_PAYSTACK })

describe('fake Paystack (E2E only)', () => {
  it('does not exist unless E2E mode is on', async () => {
    expect((await POST(new Request('http://x', { method: 'POST', body: '{}' }), ctx(['transaction', 'initialize']))).status).toBe(404)
  })
  it('initialises and verifies a transaction in Paystack\'s shape', async () => {
    process.env.E2E_FAKE_PAYSTACK = '1'
    const init = await (await POST(new Request('http://localhost:3100/x', { method: 'POST', body: JSON.stringify({ email: 'a@b.c', amount: 5000, currency: 'GHS', callback_url: 'http://localhost:3100/plans/return', metadata: { user_id: 'u1', product: 'pass_1m' } }) }), ctx(['transaction', 'initialize']))).json() as { status: boolean; data: { reference: string; authorization_url: string } }
    expect(init.status).toBe(true)
    expect(init.data.authorization_url).toContain('/api/test-paystack/pay?reference=')
    const v = await (await GET(new Request('http://x'), ctx(['transaction', 'verify', init.data.reference]))).json() as { data: { status: string; amount: number } }
    expect(v.data).toMatchObject({ status: 'ongoing', amount: 5000 })
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/fakePaystack.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `lib/billing/fakePaystackStore.ts`

```ts
// E2E ONLY: transactions the fake Paystack has seen (one dev server process)
export type FakeTx = {
  reference: string; email: string; amount: number; currency: string; callback_url: string
  metadata: Record<string, unknown>; plan: string | null; status: 'ongoing' | 'success' | 'failed'; channel: string
}
const g = globalThis as unknown as { __fakePaystack?: Map<string, FakeTx> }
export const fakeTxs = (g.__fakePaystack ??= new Map())
```

`app/api/test-paystack/[...path]/route.ts`

```ts
import crypto from 'node:crypto'
import { fakeTxs, type FakeTx } from '@/lib/billing/fakePaystackStore'

// E2E ONLY: a stand-in for Paystack's API plus a fake "pay" page.
const enabled = () => process.env.E2E_FAKE_PAYSTACK === '1' && process.env.NODE_ENV !== 'production'
const notFound = () => new Response('Not found', { status: 404 })
type Ctx = { params: Promise<{ path: string[] }> }

const txData = (t: FakeTx) => ({
  status: t.status, reference: t.reference, amount: t.amount, currency: t.currency, channel: t.channel,
  paid_at: t.status === 'success' ? new Date().toISOString() : null, metadata: t.metadata, plan: t.plan,
  customer: { customer_code: `CUS_${t.email}`, email: t.email },
  authorization: t.channel === 'card' ? { last4: '4081', brand: 'visa' } : {},
})

async function sendWebhook(origin: string, payload: object) {
  const body = JSON.stringify(payload)
  const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY ?? '').update(body).digest('hex')
  await fetch(`${origin}/api/billing/webhook`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature } })
}

async function succeed(origin: string, t: FakeTx) {
  t.status = 'success'
  await sendWebhook(origin, { event: 'charge.success', data: txData(t) })
  if (t.plan) await sendWebhook(origin, { event: 'subscription.create', data: { subscription_code: `SUB_${t.reference}`, email_token: 'tok', customer: { customer_code: `CUS_${t.email}` }, plan: { plan_code: t.plan } } })
}

export async function POST(request: Request, { params }: Ctx) {
  if (!enabled()) return notFound()
  const path = (await params).path.join('/')
  const origin = new URL(request.url).origin
  if (path === 'transaction/initialize') {
    const b = await request.json() as { email: string; amount: number; currency: string; callback_url: string; metadata: Record<string, unknown>; plan?: string; channels?: string[] }
    const reference = `FAKE_${crypto.randomUUID().slice(0, 8)}`
    fakeTxs.set(reference, { reference, email: b.email, amount: b.amount, currency: b.currency, callback_url: b.callback_url, metadata: b.metadata, plan: b.plan ?? null, status: 'ongoing', channel: b.channels?.includes('mobile_money') ? 'mobile_money' : 'card' })
    return Response.json({ status: true, data: { reference, access_code: 'x', authorization_url: `${origin}/api/test-paystack/pay?reference=${reference}` } })
  }
  if (path === 'subscription/disable') return Response.json({ status: true, message: 'Subscription disabled' })
  if (path === 'confirm-later') {
    const t = fakeTxs.get(new URL(request.url).searchParams.get('reference') ?? '')
    if (!t) return notFound()
    await succeed(origin, t)
    return Response.json({ ok: true })
  }
  return notFound()
}

export async function GET(request: Request, { params }: Ctx) {
  if (!enabled()) return notFound()
  const segs = (await params).path
  if (segs[0] === 'transaction' && segs[1] === 'verify') {
    const t = fakeTxs.get(decodeURIComponent(segs[2] ?? ''))
    return t ? Response.json({ status: true, data: txData(t) }) : Response.json({ status: false, message: 'Transaction reference not found' }, { status: 400 })
  }
  if (segs[0] === 'pay') {
    const url = new URL(request.url)
    const t = fakeTxs.get(url.searchParams.get('reference') ?? '')
    if (!t) return notFound()
    const outcome = url.searchParams.get('outcome')
    if (!outcome) {
      const link = (o: string, label: string) => `<p><a href="?reference=${t.reference}&outcome=${o}">${label}</a></p>`
      return new Response(`<!doctype html><title>Fake Paystack</title><h1>Pay GHS ${t.amount / 100}</h1>${link('success', 'Pay')}${link('fail', 'Decline')}${link('pending', 'Approve later on phone')}`, { headers: { 'Content-Type': 'text/html' } })
    }
    if (outcome === 'success') await succeed(url.origin, t)
    if (outcome === 'fail') t.status = 'failed'
    return Response.redirect(`${t.callback_url}?reference=${t.reference}&trxref=${t.reference}`, 302)
  }
  return notFound()
}
```

`playwright.config.ts` — extend `webServer.env`:

```ts
    env: {
      E2E_FAKE_AI: '1', OPENAI_API_KEY: 'e2e-fake', OPENAI_BASE_URL: `http://localhost:${PORT}/api/test-openai/v1`,
      E2E_FAKE_PAYSTACK: '1', PAYSTACK_SECRET_KEY: 'sk_test_e2e', PAYSTACK_BASE_URL: `http://localhost:${PORT}/api/test-paystack`,
      PAYSTACK_PLAN_MONTHLY: 'PLN_e2e_monthly', PAYSTACK_PLAN_YEARLY: 'PLN_e2e_yearly', NEXT_PUBLIC_BILLING_ENABLED: '1',
    },
```
(`SUPABASE_SERVICE_ROLE_KEY` comes from `.env.local`, added in Task 1.)

`app/api/test-openai/flood/route.ts`: replace the loop with `for (let i = 0; i < 10; i++) await adminClient().rpc('ai_check', { p_user: user.id, p_cost: 0 })` after reading `user` from the session (return 401 if none); import `adminClient`.

`e2e/billing.spec.ts`

```ts
import { test, expect } from '@playwright/test'
import { signUp, noteWithText } from './helpers'

test('free limit → Get Premium → pay with MoMo → Premium', async ({ page }) => {
  await signUp(page)
  await noteWithText(page)
  await page.getByRole('button', { name: '✦ Study' }).click()
  const study = page.getByRole('complementary', { name: 'Study' })
  await expect(study.getByText('10 of 10 free AI actions left today')).toBeVisible()
  expect((await page.request.post('/api/test-openai/burn-free?count=10')).ok()).toBe(true) // use up today's free actions
  await study.getByRole('button', { name: '✦ Summarise' }).click()
  await expect(study.getByText('You\'ve used today\'s 10 free AI actions')).toBeVisible()
  await study.getByRole('link', { name: '✦ Get Premium · GHS 50/month' }).click()
  await expect(page).toHaveURL(/\/plans$/)
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  await page.getByRole('link', { name: 'Pay', exact: true }).click()
  await expect(page.getByText(/You're on Premium until/)).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByText('✦ Premium').first()).toBeVisible()
  await expect(page.getByText(/GHS 50 · MoMo ✓/)).toBeVisible()
})

test('a pending MoMo payment is confirmed later', async ({ page }) => {
  await signUp(page)
  await page.goto('/plans')
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  const reference = new URL(page.url()).searchParams.get('reference')!
  await page.getByRole('link', { name: 'Approve later on phone' }).click()
  await expect(page.getByText('Confirming your payment…')).toBeVisible()
  await page.request.post(`/api/test-paystack/confirm-later?reference=${reference}`)
  await expect(page.getByText(/You're on Premium until/)).toBeVisible({ timeout: 15_000 })
})

test('a declined payment says so and charges nothing', async ({ page }) => {
  await signUp(page)
  await page.goto('/plans')
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  await page.getByRole('link', { name: 'Decline' }).click()
  await expect(page.getByText('Payment didn\'t go through. You haven\'t been charged.')).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByText('Free', { exact: true })).toBeVisible()
})

test('auto-renew by card, then turn renewal off', async ({ page }) => {
  await signUp(page)
  await page.goto('/plans')
  await page.getByRole('checkbox', { name: 'Renew automatically (card only)' }).check()
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  await page.getByRole('link', { name: 'Pay', exact: true }).click()
  await expect(page.getByText(/You're on Premium until/)).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByText(/Renews automatically \(Visa •• 4081\)/)).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Turn off renewal' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn off' }).click()
  await expect(page.getByText(/Ends on/)).toBeVisible()
})
```
`app/api/test-openai/burn-free/route.ts` — E2E-only, uses up the signed-in student's free actions for today:

```ts
import { createServerSupabase } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

// E2E ONLY: records `count` AI actions (default 10) for the signed-in student, to reach the free limit
export async function POST(request: Request) {
  if (process.env.E2E_FAKE_AI !== '1' || process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 })
  const { data: { user } } = await (await createServerSupabase()).auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const count = Math.min(10, Number(new URL(request.url).searchParams.get('count') ?? 10))
  await adminClient().rpc('ai_charge', { p_user: user.id, p_cost: count })
  return Response.json({ ok: true })
}
```
(Add it to this task's Files and to the `git add` list.)

The plan page's checkout opens the fake pay page in the same tab (`window.location.assign`), so `page.url()` after clicking Pay is the fake page with `?reference=`.

- [ ] **Step 4: Run**

Stop any running `next dev` in this folder. Then:
```bash
npx vitest run tests/unit/fakePaystack.test.ts
npx playwright test e2e/billing.spec.ts --reporter=line
npx playwright test --reporter=line
```
Expected: all pass (study spec's speed-limit test still passes through the new `flood`).

- [ ] **Step 5: Full verification and commit**

```bash
npm test
npm run test:db
npx eslint .
npx tsc --noEmit -p .
npm run build
```
All clean. Then:
```bash
git add lib/billing/fakePaystackStore.ts app/api/test-paystack app/api/test-openai e2e playwright.config.ts tests/unit/fakePaystack.test.ts
git commit -m "test: E2E for Free limit, Paystack passes, pending MoMo, decline and auto-renew with a fake Paystack"
```

---

## After this plan

- **Paystack (test mode first):** create the account and verification; plans "Premium monthly" (GHS 50, monthly) and "Premium yearly" (GHS 480, annually); webhook URL `https://<your-app>/api/billing/webhook`.
- **Check the field-name assumptions** in Global Constraints against one real test payment: Paystack's dashboard shows each webhook's payload. If a name differs, fix it in `lib/billing/paystack.ts` (and its tests) only.
- **Vercel env (Sensitive):** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_MONTHLY`, `PAYSTACK_PLAN_YEARLY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_BILLING_ENABLED=1`. Redeploy.
- `npx supabase db push` for the billing migration.
- Switch Paystack to live keys after a successful test-mode payment.
