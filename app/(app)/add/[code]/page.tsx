import { UserX } from 'lucide-react'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/EmptyState'
import { FriendInvite } from '@/components/social/FriendInvite'

// A friend link, /add/<code>. Signed-out visitors are sent to log in or sign up first and come back here.
const safeDecode = (t: string) => { try { return decodeURIComponent(t) } catch { return null } }

export default async function AddFriendPage({ params }: { params: Promise<{ code: string }> }) {
  const code = safeDecode((await params).code)?.trim().toUpperCase() ?? ''
  const dead = (
    <EmptyState icon={UserX} tone="a" level={1} title="This friend link doesn't work any more" body="The code may have been replaced. Ask your friend for their new link.">
      <Link href="/leaderboard" className="btn">Open the leaderboard</Link>
    </EmptyState>
  )
  if (!code) return dead
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  // Your own code first, so it costs none of the hourly lookups
  const { data: mine } = await sb.from('profiles').select('friend_code').eq('id', user?.id ?? '').maybeSingle<{ friend_code: string }>()
  if (mine?.friend_code === code) {
    return <EmptyState icon={UserX} tone="a" level={1} title="That's your own code" body="Send this link to a friend instead. You cannot add yourself.">
      <Link href="/leaderboard" className="btn">Open the leaderboard</Link>
    </EmptyState>
  }
  const { data: rows } = await sb.rpc('friend_code_preview', { p_code: code })
  const who = (rows as { status: string; display_name: string | null; avatar_color: string | null }[] | null)?.[0]
  if (who?.status === 'rate_limited') {
    return <EmptyState icon={UserX} tone="a" level={1} title="Couldn't look this up right now. Try again in a while." body="Too many links were opened in the last hour.">
      <Link href="/leaderboard" className="btn">Open the leaderboard</Link>
    </EmptyState>
  }
  if (!who || who.status !== 'ok' || !who.display_name || !who.avatar_color) return dead
  return <FriendInvite code={code} name={who.display_name} color={who.avatar_color} />
}
