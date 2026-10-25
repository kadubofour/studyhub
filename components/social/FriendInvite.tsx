'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/profile/Avatar'
import { sendFriendRequest, type FriendStatus } from '@/lib/data/social'
import { supabase } from '@/lib/supabase/client'

const SAID: Record<FriendStatus, string> = {
  ok: 'Request sent. You will show up on each other\'s board once they accept.',
  already_friends: 'You are already friends.',
  self: 'That\'s your own code.',
  not_found: 'This friend link doesn\'t work any more.',
  expired: 'This friend link doesn\'t work any more.',
  rate_limited: 'Too many tries. Try again in a while.',
}

// A friend link opened by a signed-in student: who it is, and the button that sends the request
export function FriendInvite({ code, name, color }: { code: string; name: string; color: string }) {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  async function send() {
    setBusy(true)
    try { setSaid(SAID[await sendFriendRequest(supabase(), code)]) } catch { setSaid('Couldn\'t send the request. Check your connection and try again.') }
    setBusy(false)
  }
  return (
    <section aria-label="Friend link" className="card mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
      <Avatar name={name} color={color} size={64} />
      <h1 className="text-lg font-semibold">{name}</h1>
      <p className="text-sm text-muted">wants to be friends on the leaderboard.</p>
      {said ? (
        <>
          <p role="status" className="max-w-sm text-sm">{said}</p>
          <Link href="/leaderboard" className="btn-primary">Open the leaderboard</Link>
        </>
      ) : (
        <button type="button" className="btn-primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send friend request'}</button>
      )}
    </section>
  )
}
