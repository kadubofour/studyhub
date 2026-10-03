# Studyhub — Billing: Free and Premium plans (Paystack) Design

Date: 2026-10-03
Status: Draft — awaiting review
Builds on: `2026-10-03-phase-2-scan-study-tools-lectures-design.md` (Phase 2). This spec replaces
Phase 2's "no caps" limits with Free and Premium plans; everything else in Phase 2 stands.

## 1. Goal

Let students in Ghana (and later worldwide) pay for Premium, so heavy AI use pays for itself,
while Free stays genuinely useful.

Success: a student hits the free daily AI limit, taps "Get Premium", pays GHS 50 with MoMo, and is
back in Studyhub on Premium within seconds; a card payer can renew automatically and turn that off
any time; nobody can make themselves Premium or reset their usage without paying.

## 2. Decisions

| Topic | Decision |
|---|---|
| Provider | **Paystack** (Ghana; MoMo and cards; GHS). Built behind a small provider interface so a second provider (e.g. a merchant of record for worldwide sales) can be added later. Stripe does not support Ghana-registered businesses. |
| Free plan | Every feature. **10 AI actions per UTC day**, big jobs by size (PDF import and scans: 1 per 10 pages, rounded up; lecture → note: 2; everything else 1; quiz marking free). **No accurate transcripts** (free live transcripts and recording are unlimited). |
| Premium | Unlimited AI and accurate transcripts, with a **fair-use ceiling** of **400 AI actions and 20 hours of accurate transcripts per calendar month (UTC)**. Reaching it shows "You've reached fair use for this month" until the 1st. |
| Everyone | Speed limit of 10 AI requests per minute; size limits as in Phase 2; email confirmation for new email accounts. |
| Prices | 1 month **GHS 50**, 3 months **GHS 135** (save 10%), 1 year **GHS 480** (save 20%). Prices are constants in one file. |
| Payment types | **Prepaid passes** (any Paystack channel incl. MoMo), and optional **auto-renew** (card only; monthly GHS 50 or yearly GHS 480 via Paystack Plans). |
| Stacking | Buying while Premium is active adds the time to the end date. |
| Ending | When Premium ends, the student is on Free immediately; no data is lost. |
| Charging | AI usage is checked before a call and counted only after success; failed or cancelled work is free (possible now that usage is server-only). |
| Trusted writes | The server uses the Supabase **service role key** for billing and usage only (`lib/supabase/admin.ts`, `server-only`). Students can read their own plan, payments and usage, never write them. |

## 3. Screens (agreed mockup)

- **Limit prompt** (Study panel, Scan, PDF import, lecture "Accurate"): "You've used today's 10 free
  AI actions. They reset in 6h 40m. Premium has no daily limit." · **✦ Get Premium · GHS 50/month** ·
  See plans. On Free, AI buttons carry "7 of 10 free AI actions left today". Choosing "Accurate"
  transcript on Free opens the same prompt ("Accurate transcripts are a Premium feature").
- **Plans** (`/plans`, also a sheet from the prompts): Free vs ✦ Premium; Premium options 1 month /
  3 months / 1 year; "Renew automatically (card only)" (enabled for 1 month and 1 year); **Pay GHS
  N with Paystack**; small print: "MoMo or card. *Fair use: 400 AI actions & 20 h transcripts a month."
- **Settings → Plan:** current plan and end date; auto-renew status (card brand •• last4) with
  "Turn off renewal"; this month's fair-use usage on Premium ("112 of 400 AI actions · 3 h of 20 h");
  "Add more time"; payment history (date, product, amount, MoMo/card, status).
- **Return page** (`/plans/return?reference=…`): "Confirming your payment…", then "You're on
  Premium until 3 Dec 2026", or the pending / failed messages in §7.
- **Banners:** "Premium ends on … · Renew" 7 days and 1 day before a pass ends (not shown when
  auto-renew is on). A small ✦ beside the student's name in the sidebar on Premium.

## 4. Data model (new migration)

```
entitlements     user_id (pk; on delete cascade), premium_until timestamptz null,
                 auto_renew bool default false, provider text default 'paystack',
                 customer_code, subscription_code, email_token, card_brand, card_last4, updated_at
payments         id, user_id, provider, reference (unique), product ('pass_1m'|'pass_3m'|'pass_12m'|
                 'renew_1m'|'renew_12m'), amount_minor int, currency, channel ('mobile_money'|'card'|
                 'other'), status ('success'|'failed'|'refunded'|'needs_review'), months int,
                 paid_at, created_at
billing_events   id (provider event key, unique), provider, type, received_at
ai_requests      + cost int default 1 (from Phase 2's speed-limit table)
transcription_usage  id, user_id, lecture_id, seconds int, at
```

- RLS: students `select` their own rows in all five; no insert/update/delete policies.
- Functions, `security definer`, **executable by `service_role` only** (revoked from `anon` and
  `authenticated`):
  - `ai_check(p_user uuid, p_cost int) → text`: `'ok'` | `'rate_limited'` (10 requests in the
    last 60 s) | `'daily_limit'` (Free: today's successful costs + p_cost > 10) | `'fair_use'`
    (Premium: this month's costs + p_cost > 400). Records the request for the speed limit.
  - `ai_charge(p_user uuid, p_cost int)`: records a successful action's cost.
  - `transcription_check(p_user uuid, p_seconds int) → text`: `'ok'` | `'premium_required'` |
    `'fair_use'` (this month's seconds + p_seconds > 72000). `transcription_record(p_user, p_lecture,
    p_seconds)`.
  - `apply_payment(...)`: in one transaction — insert the payment (ignore a known reference),
    extend `premium_until = greatest(now(), coalesce(premium_until, now())) + months`, and update
    renewal fields. `apply_refund(reference)`: mark refunded, subtract the months (not below now).
  - Phase 2's student-callable `ai_request_allowed()` is dropped (replaced by `ai_check`).
- Limits and prices live in code constants (`lib/billing/plans.ts`) **and** inside the SQL
  functions; a unit test asserts they match.

## 5. Server design

- **`lib/supabase/admin.ts`** — service-role client, `import 'server-only'`, used only by
  `lib/billing/*` and `lib/ai/run.ts`.
- **`lib/ai/run.ts`** — `runAiAction(sb, userId, call, { cost })`: `ai_check` → on `'ok'` run the
  call → on success `ai_charge`. Errors `rate_limited` (429), `daily_limit` (402, with reset time),
  `fair_use` (402). Accurate transcription uses `transcription_check` / `transcription_record`.
- **`lib/billing/paystack.ts`** — `initializeCheckout`, `verifyTransaction`, `disableSubscription`,
  `verifySignature(rawBody, header)` (HMAC-SHA512 with `PAYSTACK_SECRET_KEY`). Paystack field names,
  endpoints and event names are confirmed against Paystack's API docs at implementation time.
- **`POST /api/billing/checkout`** `{ product: '1m'|'3m'|'12m', autoRenew: boolean }` → `{ url }`.
  Uses the student's confirmed email, amount from `plans.ts`, currency GHS, metadata `{ user_id,
  product }`, `callback_url` = `/plans/return`. Passes: channels card + mobile_money. Auto-renew:
  card only, with `PAYSTACK_PLAN_MONTHLY` / `PAYSTACK_PLAN_YEARLY`; not offered for 3 months.
- **`POST /api/billing/webhook`** — raw body; reject bad/missing signature (401). Skip known event
  keys (`billing_events`). `charge.success` → `verifyTransaction(reference)`; credit only if
  status `success`, currency GHS, and amount equals the product price (else `needs_review`) →
  `apply_payment`. Subscription events (create / disable / not_renew) update auto-renew fields;
  renewal charges arrive as `charge.success` with the plan and credit 1 or 12 months.
  `refund.processed` → `apply_refund`. Always 200 after handling so Paystack doesn't retry handled
  events.
- **`GET /api/billing/confirm?reference=`** — the return page's check, with the student's session:
  same verify + `apply_payment` path (idempotent), then the student's current `premium_until`.
- **`POST /api/billing/cancel-renewal`** → `disableSubscription(subscription_code, email_token)` →
  `auto_renew = false`.
- **Env (server-only):** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_MONTHLY`, `PAYSTACK_PLAN_YEARLY`,
  `SUPABASE_SERVICE_ROLE_KEY`. Without Paystack keys: billing UI hidden, everyone on Free.

## 6. Provider interface

`lib/billing/provider.ts` defines `{ initializeCheckout, verifyTransaction, disableSubscription,
parseWebhook }` returning provider-neutral shapes (`{ reference, status, amountMinor, currency,
channel, product, userId, subscription? }`). Paystack is the only implementation now; a worldwide
provider later adds one implementation and one webhook route.

## 7. Edge cases and errors

| Situation | Behaviour |
|---|---|
| Paid but not confirmed yet | Return page polls for up to 60 s; then "We'll switch you to Premium as soon as Paystack confirms. You can keep using Studyhub." The webhook upgrades them later. |
| Failed / cancelled at Paystack | "Payment didn't go through. You haven't been charged." + Try again |
| Duplicate or out-of-order webhook | Handled once (`billing_events`, unique `reference`) |
| Amount/currency mismatch | Not credited; payment saved as `needs_review` |
| Refund (from Paystack dashboard) | Payment `refunded`; that time removed from Premium |
| Premium ends | Free limits apply immediately; no data lost |
| Renewal turned off | Premium until the paid end date; Plan shows "Ends on …" |
| Pass bought while auto-renewing | Time added; renewals continue |
| Billing not configured | Upgrade UI hidden; everyone Free |
| Account deleted | Entitlement and payment rows cascade; Paystack keeps its own records |
| Checkout can't start | "Couldn't start checkout. Try again." |
| Turn off renewal fails | "Couldn't turn off renewal. Try again or contact support." |

## 8. Testing (TDD)

- **Unit:** signature verification (valid / bad / missing); time extension (from now, from a future
  end, each product, renewals) and refund; payment matching (amount, currency, product);
  idempotency; `plans.ts` constants match the SQL; usage results mapped to messages; plan picker,
  Settings → Plan, limit prompts, return page states.
- **DB:** students read but can't write `entitlements` / `payments` / usage; billing and usage
  functions refuse `authenticated` callers; free daily limit, Premium fair use, transcription
  limits; concurrent `ai_check` calls respect the limits; `apply_payment` twice with one reference
  credits once.
- **E2E (fake Paystack routes behind `E2E_FAKE_PAYSTACK=1`, like the fake OpenAI):** buy a pass →
  Premium; pending then confirmed by webhook; failed payment; free limit → prompt → upgrade; turn
  off renewal.
- **Manual, before going live:** Paystack test mode with a test card and a test MoMo number,
  confirming webhooks arrive at the deployed URL.

## 9. Setup (app owner)

1. Paystack account + business verification (Ghana).
2. In Paystack: create plans "Premium monthly" (GHS 50, monthly) and "Premium yearly" (GHS 480,
   annually); set the webhook URL to `https://<your-app>/api/billing/webhook`.
3. Vercel env (server-only, Sensitive): `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_MONTHLY`,
   `PAYSTACK_PLAN_YEARLY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API).
4. Keep the OpenAI prepaid credit with auto-recharge off as the overall ceiling.

## 10. Build order

After Phase 2 Plan A (AI foundations + study tools): billing data and server-only usage functions
→ `runAiAction` on the new checks (free limit, fair use, charge on success) → Paystack client,
checkout, webhook, confirm → Plans page, return page, Settings → Plan, limit prompts, banners →
E2E with fake Paystack. Then Phase 2 Plans B (Scan) and C (Lectures) use the same checks.

## 11. Out of scope

Other currencies and providers (worldwide launch); coupons, student discounts and free trials;
family/group plans; invoices with tax details; in-app refunds; emails sent by Studyhub itself
(Paystack sends receipts).
