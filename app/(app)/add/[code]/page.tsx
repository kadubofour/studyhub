import { UserX } from 'lucide-react'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/EmptyState'
import { FriendInvite } from '@/components/social/FriendInvite'

// A friend link, /add/<code>. Signed-out visitors are sent to log in or sign up first and come back here.
export default async function AddFriendPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  const code = decodeURIComponent(raw).trim().toUpperCase()
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  const [{ data: mine }, { data: rows }] = await Promise.all([
    sb.from('profiles').select('friend_code').eq('id', user?.id ?? '').maybeSingle<{ friend_code: string }>(),
    sb.rpc('friend_code_preview', { p_code: code }),
  ])
  if (mine?.friend_code === code) {
    return <EmptyState icon={UserX} tone="a" level={1} title="That's your own code" body="Send this link to a friend instead. You cannot add yourself.">
      <Link href="/leaderboard" className="btn">Open the leaderboard</Link>
    </EmptyState>
  }
  const who = (rows as { display_name: string; avatar_color: string }[] | null)?.[0]
  if (!who) {
    return <EmptyState icon={UserX} tone="a" level={1} title="This friend link doesn't work any more" body="The code may have been replaced. Ask your friend for their new link.">
      <Link href="/leaderboard" className="btn">Open the leaderboard</Link>
    </EmptyState>
  }
  return <FriendInvite code={code} name={who.display_name} color={who.avatar_color} />
}
