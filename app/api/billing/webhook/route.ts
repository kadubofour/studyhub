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
  const { error: logged } = await admin.from('billing_events').insert({ id: key, provider: 'paystack', type: event })
  if (logged?.code === '23505') return NextResponse.json({ ok: true }) // already handled
  if (logged) return NextResponse.json({ error: 'failed' }, { status: 500 })
  // A database error must not be mistaken for success, or the event is never retried
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { error } = await admin.rpc(fn, args); if (error) throw error }

  try {
    if (event === 'charge.success') {
      const charge = await verifyTransaction(String(data.reference))
      const userId = await userForCharge(charge)
      if (!userId) throw new Error('student not known yet') // retried: a renewal can arrive before its first charge
      await creditVerifiedCharge(charge, userId)
    } else if (event === 'refund.processed') {
      const reference = str(data.transaction_reference) ?? str((data.transaction as Record<string, unknown> | undefined)?.reference)
      if (reference) await rpc('apply_refund', { p_reference: reference })
    } else {
      const customer = str((data.customer as Record<string, unknown> | undefined)?.customer_code)
      const userId = await userForCharge({ userId: null, customerCode: customer } as never)
      if (!userId) throw new Error('student not known yet') // retried: Paystack may send this before charge.success
      await rpc('set_subscription', {
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
