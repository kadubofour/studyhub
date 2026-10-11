import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { billing } from '@/lib/billing/provider'

// Where a student's files live; every path starts with their user id
const BUCKETS = ['imports', 'lectures'] as const
const BATCH = 100

// Every file under a folder, going into sub-folders (entries with no id are folders)
async function filesUnder(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) throw error
  const out: string[] = []
  for (const e of data ?? []) {
    if (e.id === null) out.push(...await filesUnder(admin, bucket, `${prefix}/${e.name}`))
    else out.push(`${prefix}/${e.name}`)
  }
  return out
}

// POST { confirm: "DELETE" }: leaves for good. Renewal is turned off first (so nobody keeps paying for a gone account),
// then the student's files, then the sign-in, which takes every row with it. A failure before the last step leaves the account usable.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { confirm?: unknown } | null
  if (body?.confirm !== 'DELETE') return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const admin = adminClient()
  const failed = () => NextResponse.json({ error: 'delete_failed' }, { status: 502 })
  try {
    const { data: ent } = await admin.from('entitlements').select('subscription_code,email_token').eq('user_id', user.id).maybeSingle()
    const e = ent as { subscription_code: string | null; email_token: string | null } | null
    if (e?.subscription_code && e.email_token) await billing.disableSubscription(e.subscription_code, e.email_token)

    for (const bucket of BUCKETS) {
      const paths = await filesUnder(admin, bucket, user.id)
      for (let i = 0; i < paths.length; i += BATCH) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + BATCH))
        if (error) throw error
      }
    }
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error
  } catch {
    return failed()
  }
  await sb.auth.signOut().catch(() => {})
  return NextResponse.json({ ok: true })
}
