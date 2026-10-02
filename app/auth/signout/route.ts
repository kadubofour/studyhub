import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Used when a signed-in user can't be loaded (e.g. their profile is unreadable): signing out
// first stops the proxy bouncing /login → /home → /login forever.
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const sb = await createServerSupabase()
  await sb.auth.signOut()
  const reason = searchParams.get('reason') === 'profile' ? 'profile' : 'signout'
  return NextResponse.redirect(`${origin}/login?error=${reason}`)
}
