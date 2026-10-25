import { UserX } from 'lucide-react'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/EmptyState'
import { GroupInvite } from '@/components/social/GroupInvite'
import { groupPreview } from '@/lib/data/social'
import { inviteToken } from '@/lib/social/links'

// A study group's invite link, /join/<token>. Signed-out visitors are sent to log in or sign up first and come back here.
export default async function JoinGroupPage({ params }: { params: Promise<{ token: string }> }) {
  let raw = (await params).token
  try { raw = decodeURIComponent(raw) } catch { raw = '' }
  const token = inviteToken(raw)
  const group = token ? await groupPreview(await createServerSupabase(), token).catch(() => null) : null
  if (!group) {
    return <EmptyState icon={UserX} tone="a" level={1} title="This invite doesn't work any more" body="It may have been replaced by a new one. Ask for the latest link.">
      <Link href="/leaderboard" className="btn">Open the leaderboard</Link>
    </EmptyState>
  }
  return <GroupInvite token={token} name={group.name} members={group.members} />
}
