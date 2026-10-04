import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { billing } from '@/lib/billing/provider'
import { creditVerifiedCharge, userForCharge } from '@/lib/billing/credit'

// Payment provider notifications. The signature covers the raw body; every charge is re-verified
// with the provider before crediting; each event is handled once (billing_events).
export async function POST(request: Request) {
  const raw = await request.text()
  if (!billing.verifySignature(raw, request.headers.get(billing.signatureHeader))) return NextResponse.json({ error: 'bad_signature' }, { status: 401 })
  const event = billing.parseWebhook(raw)
  if (!event) return NextResponse.json({ ok: true })

  const admin = adminClient()
  const { error: logged } = await admin.from('billing_events').insert({ id: event.key, provider: billing.name, type: event.type })
  if (logged?.code === '23505') return NextResponse.json({ ok: true }) // already handled
  if (logged) return NextResponse.json({ error: 'failed' }, { status: 500 })
  // A database error must not be mistaken for success, or the event is never retried
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { error } = await admin.rpc(fn, args); if (error) throw error }

  try {
    if (event.kind === 'charge') {
      const charge = await billing.verifyTransaction(event.reference)
      const userId = await userForCharge(charge)
      if (!userId) throw new Error('student not known yet') // retried: a renewal can arrive before its first charge
      await creditVerifiedCharge(charge, userId)
    } else if (event.kind === 'refund') {
      if (event.reference) await rpc('apply_refund', { p_reference: event.reference, p_amount_minor: event.amountMinor })
    } else {
      const userId = await userForCharge({ userId: null, customerCode: event.customerCode } as never)
      if (!userId) throw new Error('student not known yet') // retried: the provider may send this before the charge
      await rpc('set_subscription', {
        p_user: userId, p_subscription_code: event.subscriptionCode, p_email_token: event.emailToken, p_auto_renew: event.active,
      })
    }
    return NextResponse.json({ ok: true })
  } catch {
    await admin.from('billing_events').delete().eq('id', event.key) // let the provider's retry try again
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
