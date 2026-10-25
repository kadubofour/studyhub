'use client'
import { useState } from 'react'
import { Copy, RefreshCw, Share2, UserMinus, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/profile/Avatar'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { BTN_ICON } from '@/components/ui/buttonStyles'
import { newFriendCode, removeFriend, respondFriendRequest, sendFriendRequest, type Friend, type FriendRequest, type FriendStatus } from '@/lib/data/social'
import { friendLink } from '@/lib/social/links'
import { supabase } from '@/lib/supabase/client'
import { InPersonDialog } from './InPersonDialog'

const SEND: Record<Exclude<FriendStatus, 'ok'>, string> = {
  not_found: 'No one has that code. Check it and try again.',
  expired: 'No one has that code. Check it and try again.',
  self: 'That is your own code.',
  already_friends: 'You are already friends.',
  rate_limited: 'Too many tries. Try again in an hour.',
}
const nameOf = (n: string | null) => n || 'Student'

/** Copies text, saying so; false when the browser would not */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

// The student's own code and link, adding a friend (by code or in person), requests waiting, and the friends list.
// `onChange` reloads the friends, the requests and the board after anything that changes them, and gives the new friends.
export function FriendsPanel({ friends, requests, onChange }: { friends: Friend[]; requests: FriendRequest[]; onChange: () => Promise<Friend[]> }) {
  const { profile, setProfile } = useProfile()
  const toast = useToast()
  const confirm = useConfirm()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [inPerson, setInPerson] = useState(false)
  const link = () => friendLink(window.location.origin, profile.friend_code)

  async function copyCode() { toast(await copyText(profile.friend_code) ? 'Code copied.' : 'Couldn\'t copy. Select the code instead.') }
  async function share() {
    const url = link()
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'Add me on Studyhub', text: 'Add me as a friend on Studyhub', url }); return } catch (e) { if (e instanceof Error && e.name === 'AbortError') return }
    }
    toast(await copyText(url) ? 'Link copied.' : 'Couldn\'t copy the link.')
  }
  async function renew() {
    if (!await confirm({ title: 'Make a new code?', body: 'Your current code and link stop working. Friends you have stay friends.', confirmLabel: 'New code' })) return
    try {
      const c = await newFriendCode(supabase())
      setProfile(p => ({ ...p, friend_code: c }))
      toast('New code made.')
    } catch (e) { toast(e instanceof Error && e.message === 'rate_limited' ? 'Too many new codes. Try again in an hour.' : 'Couldn\'t make a new code.') }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const c = code.trim()
    if (!c || busy) return
    setBusy(true)
    try {
      const status = await sendFriendRequest(supabase(), c)
      if (status === 'ok') {
        setCode('')
        // they may have asked us first, in which case we are friends already
        const now = await onChange()
        toast(now.length > friends.length ? 'You are friends now.' : 'Request sent. You will show up on each other\'s board once they accept.')
      } else toast(SEND[status])
    } catch { toast('Couldn\'t send the request. Check your connection.') }
    setBusy(false)
  }

  async function respond(r: FriendRequest, accept: boolean) {
    try {
      await respondFriendRequest(supabase(), r.from_id, accept)
      await onChange()
      if (accept) toast(`You and ${nameOf(r.display_name)} are friends now.`)
    } catch { toast('Couldn\'t answer the request.') }
  }

  async function remove(f: Friend) {
    if (!await confirm({ title: `Remove ${nameOf(f.display_name)}?`, body: 'You leave each other\'s friends board. You can add each other again later.', confirmLabel: 'Remove', danger: true })) return
    try { await removeFriend(supabase(), f.user_id); await onChange() } catch { toast('Couldn\'t remove them.') }
  }

  return (
    <div className="space-y-5">
      {requests.length > 0 && (
        <section aria-label="Friend requests" className="card p-5">
          <h2 className="section-label !mb-3">Requests <span className="font-normal text-muted">{requests.length}</span></h2>
          <ul className="space-y-3">
            {requests.map(r => (
              <li key={r.from_id} className="flex flex-wrap items-center gap-3">
                <Avatar name={r.display_name} color={r.avatar_color} size={32} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{nameOf(r.display_name)}</span>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary !min-h-9 !px-3.5 !text-sm" aria-label={`Accept ${nameOf(r.display_name)}`} onClick={() => respond(r, true)}>Accept</button>
                  <button type="button" className="btn !min-h-9 !px-3.5 !text-sm" aria-label={`Decline ${nameOf(r.display_name)}`} onClick={() => respond(r, false)}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Add friends" className="card p-5">
        <h2 className="section-label !mb-3">Add friends</h2>
        <div className="rounded-xl bg-surface p-3.5">
          <div className="text-xs font-medium text-muted" id="my-code">Your code</div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span aria-labelledby="my-code" className="font-display text-2xl font-semibold tracking-[0.12em] tabular-nums">{profile.friend_code}</span>
            <button type="button" className={BTN_ICON} aria-label="New code" title="New code (the old one stops working)" onClick={renew}><RefreshCw size={16} aria-hidden /></button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn justify-center" onClick={copyCode}><Copy size={15} aria-hidden />Copy</button>
            <button type="button" className="btn justify-center" onClick={share}><Share2 size={15} aria-hidden />Share link</button>
          </div>
        </div>
        <form onSubmit={send} className="mt-4">
          <label className="field"><span>A friend&apos;s code</span>
            <div className="flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCD2345" autoComplete="off" autoCapitalize="characters" maxLength={20} className="min-w-0 flex-1 uppercase tracking-wider" />
              <button className="btn-primary" disabled={!code.trim() || busy}>Send</button>
            </div>
          </label>
        </form>
        <button type="button" className="btn mt-3 w-full justify-center" onClick={() => setInPerson(true)}><UsersRound size={15} aria-hidden />Add in person</button>
      </section>

      {friends.length > 0 && (
        <section aria-label="Your friends" className="card p-5">
          <h2 className="section-label !mb-3">Friends <span className="font-normal text-muted">{friends.length}</span></h2>
          <ul className="space-y-2.5">
            {friends.map(f => (
              <li key={f.user_id} className="flex items-center gap-3">
                <Avatar name={f.display_name} color={f.avatar_color} size={30} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{nameOf(f.display_name)}</span>
                <button type="button" className={BTN_ICON} aria-label={`Remove ${nameOf(f.display_name)}`} title="Remove friend" onClick={() => remove(f)}><UserMinus size={16} aria-hidden /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inPerson && <InPersonDialog onClose={() => setInPerson(false)} onFriends={() => void onChange()} />}
    </div>
  )
}
