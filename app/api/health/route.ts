import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }

// For an uptime monitor: ok when the app is up and can reach its database. It says nothing else, so it reveals no setting.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ ok: false }, { status: 503, headers })
  try {
    // Row-level security returns nothing to an anonymous caller; an answer without an error means the database is there
    const { error } = await createClient(url, key, { auth: { persistSession: false } }).from('profiles').select('id').limit(1)
    return error ? NextResponse.json({ ok: false }, { status: 503, headers }) : NextResponse.json({ ok: true }, { headers })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers })
  }
}
