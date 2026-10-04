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
  if (autoRenew) {
    // A second Paystack subscription would charge the card twice, and Settings can cancel only one
    const { data: ent } = await sb.from('entitlements').select('auto_renew').maybeSingle()
    if (ent?.auto_renew) return err(409, 'already_renewing')
  }
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
