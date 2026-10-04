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
