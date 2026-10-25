'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { joinGroup } from '@/lib/data/social'
import { supabase } from '@/lib/supabase/client'

const SAID: Record<string, string> = {
  group_full: 'This group is full, so you can\'t join it.',
  not_found: 'This invite doesn\'t work any more. Ask for a new one.',
  rate_limited: 'Too many tries. Try again in a while.',
}

// A group invite opened by a signed-in student: the group, and the button that joins it
export function GroupInvite({ token, name, members }: { token: string; name: string; members: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  async function join() {
    setBusy(true); setSaid(null)
    try {
      const { status, group_id } = await joinGroup(supabase(), token)
      if (status === 'ok' && group_id) { router.push(`/leaderboard?group=${group_id}`); return }
      setSaid(SAID[status] ?? SAID.not_found)
    } catch { setSaid('Couldn\'t join. Check your connection and try again.') }
    setBusy(false)
  }
  return (
    <section aria-label="Group invite" className="card mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
      <span data-art aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-surface text-muted"><Users size={26} /></span>
      <h1 className="text-lg font-semibold">{name}</h1>
      <p className="text-sm text-muted">{members} {members === 1 ? 'member' : 'members'}</p>
      {said && <p role="status" className="max-w-sm text-sm">{said}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={join}>{busy ? 'Joining…' : 'Join group'}</button>
        <Link href="/leaderboard" className="btn">Not now</Link>
      </div>
    </section>
  )
}
