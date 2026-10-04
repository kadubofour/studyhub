import 'server-only'
import crypto from 'node:crypto'

import type { BillingEvent, CheckoutRequest, VerifiedCharge } from './provider'

// Everything Paystack-specific lives here, so field-name differences are fixed in one file.
// It implements the BillingProvider interface in ./provider.

export type { VerifiedCharge }
export class PaystackError extends Error {}

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

export async function initializeCheckout(o: CheckoutRequest): Promise<{ url: string; reference: string }> {
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

// Paystack's webhook payload → a provider-neutral event (null for events Studyhub doesn't use)
export function parseWebhook(rawBody: string): BillingEvent | null {
  let payload: { event?: unknown; data?: Record<string, unknown> }
  try { payload = JSON.parse(rawBody) } catch { return null }
  const type = typeof payload?.event === 'string' ? payload.event : ''
  const data = payload?.data ?? {}
  const key = `${type}:${str(data.reference) ?? str(data.subscription_code) ?? String(data.id ?? '')}`
  if (type === 'charge.success') return { kind: 'charge', type, key, reference: String(data.reference ?? '') }
  if (type === 'subscription.create' || type === 'subscription.disable' || type === 'subscription.not_renew') {
    const active = type === 'subscription.create'
    return {
      kind: 'subscription', type, key, active,
      customerCode: str((data.customer as Record<string, unknown> | undefined)?.customer_code),
      subscriptionCode: str(data.subscription_code), emailToken: active ? str(data.email_token) : null,
    }
  }
  if (type === 'refund.processed') {
    return {
      kind: 'refund', type, key,
      reference: str(data.transaction_reference) ?? str((data.transaction as Record<string, unknown> | undefined)?.reference),
      // what was refunded; less than the payment means a partial refund
      amountMinor: typeof data.amount === 'number' ? data.amount : null,
    }
  }
  return null
}

export function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header || !secret()) return false
  const expected = crypto.createHmac('sha512', secret()).update(rawBody).digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(header)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
