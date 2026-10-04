import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { PRODUCTS, type ProductId } from './plans'
import type { VerifiedCharge } from './provider'

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
    p_user: userId, p_reference: c.reference, p_product: product, p_amount_minor: c.amountMinor,
    p_currency: c.currency, p_channel: c.channel, p_status: state === 'credited' ? 'success' : state,
    p_months: state === 'credited' ? PRODUCTS[product!].months : 0, p_paid_at: c.paidAt,
    p_customer_code: c.customerCode, p_card_brand: c.cardBrand, p_card_last4: c.cardLast4,
  })
  if (error) throw error
  return { state, premiumUntil: (data as string | null) ?? null }
}
