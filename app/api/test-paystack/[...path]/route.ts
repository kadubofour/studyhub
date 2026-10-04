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
