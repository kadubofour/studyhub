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
