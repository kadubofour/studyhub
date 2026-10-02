import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Used by the app layout when a signed-in user's profile can't be loaded: signing out stops the
// proxy bouncing /login → /home → /login forever. It only acts in that situation, so a link to
// this URL on another site can't sign a healthy student out.
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)
  const { data: profile, error } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (profile && !error) return NextResponse.redirect(`${origin}/home`)
  await sb.auth.signOut()
  return NextResponse.redirect(`${origin}/login?error=profile`)
}
