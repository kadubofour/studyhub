'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Copy, FileText, Layers, Share2, Trophy, UserPlus, Users, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/profile/Avatar'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import {
  FriendCodeError, acceptFriendRequest, listFriends, myFriendCode, removeFriendship, removeShare, sendFriendRequest, sharedByMe, sharedWithMe, weekBoard,
  type BoardRow, type Friend, type SharedByMe, type SharedWithMe,
} from '@/lib/data/friends'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const KIND_ICON = { note: FileText, deck: Layers }
const SENT: Record<string, string> = {
  sent: 'Request sent. You will be friends once they accept.',
  accepted: 'You are now friends: they had already asked you.',
  already_asked: 'You already asked them. Waiting for them to accept.',
  already_friends: 'You are already friends.',
}

// Friends: this week's XP board among friends, adding friends by code or invite link, requests, and what was shared
export default function FriendsPage() {
  const { profile } = useProfile()
  const confirm = useConfirm()
  const toast = useToast()
  const invited = useSearchParams().get('code')
  const [code, setCode] = useState<string | null>(null)
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [board, setBoard] = useState<BoardRow[] | null>(null)
  const [withMe, setWithMe] = useState<SharedWithMe[]>([])
  const [byMe, setByMe] = useState<SharedByMe[]>([])
  const [failed, setFailed] = useState(false)
  const [entry, setEntry] = useState(invited?.toUpperCase() ?? '')
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const codeInput = useRef<HTMLInputElement>(null)

  // Everything is read again after each change (adding, accepting, removing, unsharing)
  const [version, setVersion] = useState(0)
  const load = () => setVersion(v => v + 1)
  useEffect(() => {
    let live = true
    const sb = supabase()
    Promise.all([myFriendCode(sb), listFriends(sb), weekBoard(sb, profile.timezone), sharedWithMe(sb), sharedByMe(sb)])
      .then(([c, f, b, w, m]) => { if (live) { setCode(c); setFriends(f); setBoard(b); setWithMe(w); setByMe(m); setFailed(false) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [profile.timezone, version])
  useEffect(() => { if (invited) codeInput.current?.focus() }, [invited])

  const accepted = (friends ?? []).filter(f => f.status === 'accepted')
  const incoming = (friends ?? []).filter(f => f.status === 'pending' && f.incoming)
  const outgoing = (friends ?? []).filter(f => f.status === 'pending' && !f.incoming)
  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/friends?code=${code}` : ''

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!entry.trim() || busy) return
    setBusy(true); setMessage(null)
    try {
      const r = await sendFriendRequest(supabase(), entry)
      setMessage({ text: SENT[r] }); setEntry(''); load()
    } catch (err) {
      setMessage({ text: err instanceof FriendCodeError ? err.message : 'Couldn\'t send the request. Try again.', bad: true })
    } finally { setBusy(false) }
  }
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied.`) } catch { toast(`Couldn't copy. Your ${what.toLowerCase()} is ${text}`) }
  }
  async function invite() {
    if (navigator.share) { try { await navigator.share({ title: 'Study with me on Studyhub', text: `Add me on Studyhub: my code is ${code}`, url: link }); return } catch { return } }
    await copy(link, 'Invite link')
  }
  async function act(run: () => Promise<void>, failText: string) {
    try { await run(); load() } catch { toast(failText) }
  }
  async function unfriend(f: Friend) {
    if (!await confirm({ title: `Remove ${f.display_name}?`, body: 'You stop seeing each other on the board, and anything you shared with each other is unshared. Your own copies stay.', confirmLabel: 'Remove', danger: true })) return
    await act(() => removeFriendship(supabase(), f.id), 'Couldn\'t remove. Try again.')
  }

  return (
    <div>
      <PageHeader title="Friends" summary={friends ? `${accepted.length} friend${accepted.length === 1 ? '' : 's'}${incoming.length ? ` · ${incoming.length} asking to be friends` : ''}` : undefined} />
      {failed && (
        <div role="alert" className="card mb-6 flex flex-wrap items-center gap-3 text-sm text-danger">
          Couldn&apos;t load your friends. Check your connection.<button type="button" className="btn" onClick={load}>Try again</button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="board-title" className="card">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id="board-title" className="section-label !mb-0 flex items-center gap-2 whitespace-nowrap"><Trophy size={18} className="text-accent" aria-hidden />This week</h2>
              <span className="text-sm text-muted">Starts again on Monday</span>
            </div>
            {board && (
              <ol aria-label="This week's XP" className="space-y-1">
                {board.map((r, i) => (
                  <li key={r.user_id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${r.is_me ? 'bg-accent-soft' : ''}`}>
                    <span className="w-6 shrink-0 text-center font-semibold tabular-nums text-muted">{i + 1}</span>
                    <Avatar name={r.display_name} color={r.avatar_color} size={34} />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.is_me ? `${r.display_name} (you)` : r.display_name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{r.xp} XP</span>
                  </li>
                ))}
              </ol>
            )}
            {board && board.length < 2 && <p className="mt-3 text-sm text-muted">Add a friend to see how your week compares. Everyone starts again on Monday.</p>}
          </section>

          <section aria-labelledby="with-me-title" className="card">
            <h2 id="with-me-title" className="section-label">Shared with you</h2>
            {withMe.length === 0 ? <p className="text-sm text-muted">When a friend shares a note or a deck with you, it shows here.</p> : (
              <ul className="-mx-2 space-y-0.5">
                {withMe.map(s => {
                  const Icon = KIND_ICON[s.kind]
                  return (
                    <li key={s.id} className="flex items-center gap-1">
                      <Link href={`/friends/shared/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface">
                        <Icon size={18} className="shrink-0 text-muted" aria-hidden />
                        <span className="min-w-0"><span className="block truncate font-medium">{s.title}</span><span className="block truncate text-sm text-muted">From {s.owner_name} · {shortDate(s.created_at)}</span></span>
                      </Link>
                      <button type="button" className="btn-ghost shrink-0" aria-label={`Take “${s.title}” off your list`} title="Take off your list"
                        onClick={() => { void act(() => removeShare(supabase(), s.id), 'Couldn\'t remove it. Try again.') }}><X size={16} aria-hidden /></button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {byMe.length > 0 && (
            <section aria-labelledby="by-me-title" className="card">
              <h2 id="by-me-title" className="section-label">Shared by you</h2>
              <ul className="space-y-2">
                {byMe.map(s => {
                  const Icon = KIND_ICON[s.kind]
                  return (
                    <li key={s.id} className="flex items-center gap-3">
                      <Icon size={18} className="shrink-0 text-muted" aria-hidden />
                      <Link href={s.kind === 'note' ? `/notes/${s.item_id}` : `/flashcards/${s.item_id}`} className="min-w-0 flex-1 hover:text-accent">
                        <span className="block truncate font-medium">{s.title}</span><span className="block truncate text-sm text-muted">With {s.recipient_name}</span>
                      </Link>
                      <button type="button" className="btn shrink-0" onClick={() => { void act(() => removeShare(supabase(), s.id), 'Couldn\'t stop sharing. Try again.') }}>Stop sharing</button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="add-title" className="card">
            <h2 id="add-title" className="section-label flex items-center gap-2"><UserPlus size={18} className="text-accent" aria-hidden />Add a friend</h2>
            <p className="text-sm text-muted">Your code</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span aria-label={code ? `Your code is ${code.split('').join(' ')}` : undefined} className="font-mono text-2xl font-semibold tracking-[0.2em]">{code ?? '········'}</span>
              <button type="button" className="btn" disabled={!code} onClick={() => { if (code) void copy(code, 'Code') }}><Copy size={14} aria-hidden />Copy</button>
              <button type="button" className="btn" disabled={!code} onClick={() => { void invite() }}><Share2 size={14} aria-hidden />Invite link</button>
            </div>
            <form onSubmit={e => { void add(e) }} className="mt-5 space-y-2">
              <label className="field"><span>A friend&apos;s code</span>
                <input ref={codeInput} value={entry} onChange={e => setEntry(e.target.value.toUpperCase())} placeholder="ABCD2345" maxLength={12} autoCapitalize="characters" autoComplete="off" className="font-mono tracking-widest" />
              </label>
              <button className="btn-primary" disabled={busy || !entry.trim()}>{busy ? 'Sending…' : 'Add friend'}</button>
              {message && <p role={message.bad ? 'alert' : 'status'} className={`text-sm ${message.bad ? 'text-danger' : 'text-muted'}`}>{message.text}</p>}
            </form>
          </section>

          {(incoming.length > 0 || outgoing.length > 0) && (
            <section aria-labelledby="requests-title" className="card">
              <h2 id="requests-title" className="section-label">Requests</h2>
              <ul className="space-y-3">
                {incoming.map(f => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3">
                    <Avatar name={f.display_name} color={f.avatar_color} size={34} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{f.display_name}</span><span className="block text-sm text-muted">Wants to be friends</span></span>
                    <span className="flex gap-2">
                      <button type="button" className="btn-primary" onClick={() => { void act(() => acceptFriendRequest(supabase(), f.id), 'Couldn\'t accept. Try again.') }}><Check size={14} aria-hidden />Accept</button>
                      <button type="button" className="btn" onClick={() => { void act(() => removeFriendship(supabase(), f.id), 'Couldn\'t decline. Try again.') }}>Decline</button>
                    </span>
                  </li>
                ))}
                {outgoing.map(f => (
                  <li key={f.id} className="flex items-center gap-3">
                    <Avatar name={f.display_name} color={f.avatar_color} size={34} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{f.display_name}</span><span className="block text-sm text-muted">Waiting for them to accept</span></span>
                    <button type="button" className="btn" onClick={() => { void act(() => removeFriendship(supabase(), f.id), 'Couldn\'t cancel. Try again.') }}>Cancel</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="friends-title" className="card">
            <h2 id="friends-title" className="section-label flex items-center gap-2"><Users size={18} className="text-accent" aria-hidden />Your friends</h2>
            {friends && accepted.length === 0 && <p className="text-sm text-muted">No friends yet. Send your code or invite link to a classmate.</p>}
            <ul className="space-y-3">
              {accepted.map(f => (
                <li key={f.id} className="flex items-center gap-3">
                  <Avatar name={f.display_name} color={f.avatar_color} size={34} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{f.display_name}</span><span className="block text-sm text-muted">Friends since {shortDate(f.since)}</span></span>
                  <button type="button" className="btn-ghost text-danger" onClick={() => { void unfriend(f) }}>Remove</button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
