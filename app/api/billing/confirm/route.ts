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
