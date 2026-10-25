'use client'
import { useEffect, useRef, useState } from 'react'
import { UsersRound } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/providers/ToastProvider'
import { myFriends, redeemInPerson, startInPerson, type FriendStatus } from '@/lib/data/social'
import { supabase } from '@/lib/supabase/client'

const MESSAGES: Record<Exclude<FriendStatus, 'ok'>, string> = {
  expired: 'That code is wrong or has run out. Ask for a new one.',
  not_found: 'That code is wrong or has run out. Ask for a new one.',
  self: 'That is your own code. The other person enters it.',
  already_friends: 'You are already friends.',
  rate_limited: 'Too many tries. Try again in an hour.',
}
const clock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

// Add in person, when both are there: one shows a 6-digit code that works for 5 minutes, the other types it, and they are
// friends at once. Mount it to open it. (No QR: the app has no QR library, so the code is drawn large instead.) While the code shows, the
// friends list is checked every few seconds, so the one showing it learns at once that it was used.
export function InPersonDialog({ onClose, onFriends }: { onClose: () => void; onFriends: () => void }) {
  const toast = useToast()
  const [mode, setMode] = useState<'show' | 'enter'>('show')
  const [shown, setShown] = useState<{ code: string; expires: number; friends: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [entered, setEntered] = useState('')
  const [busy, setBusy] = useState(false)

  // A new code, with how many friends there are now (a new one arriving means the code was used)
  const fetchCode = async () => {
    const sb = supabase()
    const [c, f] = await Promise.all([startInPerson(sb), myFriends(sb)])
    return { code: c.code, expires: new Date(c.expires_at).getTime(), friends: f.length }
  }
  const failed = (e: unknown) => toast(e instanceof Error && e.message === 'rate_limited' ? 'Too many codes. Try again in an hour.' : 'Couldn\'t make a code.')
  function makeCode() { fetchCode().then(setShown, failed) }

  const showing = mode === 'show' && shown !== null && now < shown.expires
  // The countdown, and a look at the friends list every 3 seconds while the code can still be used
  useEffect(() => {
    if (!showing || !shown) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(() => {
      myFriends(supabase()).then(f => {
        if (f.length > shown.friends) {
          toast('You are friends now.')
          setShown(null)
          onFriends()
          onClose()
        }
      }).catch(() => {})
    }, 3000)
    return () => { clearInterval(tick); clearInterval(poll) }
  }, [showing, shown, toast, onFriends, onClose])

  async function redeem(e: React.FormEvent) {
    e.preventDefault()
    const code = entered.replace(/\D/g, '')
    if (code.length !== 6 || busy) return
    setBusy(true)
    try {
      const status = await redeemInPerson(supabase(), code)
      if (status === 'ok') {
        toast('You are friends now.')
        setEntered('')
        onFriends()
        onClose()
      } else toast(MESSAGES[status])
    } catch { toast('Couldn\'t add them. Check your connection.') }
    setBusy(false)
  }

  function pick(m: 'show' | 'enter') {
    setMode(m)
    if (m === 'show' && (!shown || now >= shown.expires)) makeCode()
  }

  // Opening on "Show my code" makes a code at once (the dialog is mounted when it opens). Only once: a second code made
  // alongside (Strict Mode runs effects twice) would replace the first in the database, maybe after it was shown.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    fetchCode().then(setShown, failed)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const left = shown ? shown.expires - now : 0
  return (
    <Dialog open onClose={onClose} title="Add in person" icon={UsersRound} subtitle="For when you are together: friends at once, no request.">
      <div role="radiogroup" aria-label="Show or enter a code" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
        {(['show', 'enter'] as const).map(m => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { if (mode !== m) pick(m) }}
            className={`min-h-10 rounded-xl text-sm font-medium transition pointer-coarse:min-h-11 ${mode === m ? 'bg-raised text-fg shadow-sm' : 'text-muted hover:text-fg'}`}>
            {m === 'show' ? 'Show my code' : 'Enter a code'}
          </button>
        ))}
      </div>
      {mode === 'show' ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          {shown && left > 0 ? (
            <>
              <p className="text-sm text-muted">Ask them to choose Enter a code and type:</p>
              <output aria-label="Your in-person code" className="font-display text-5xl font-semibold tracking-[0.18em] tabular-nums sm:text-6xl">{shown.code}</output>
              <p className="text-sm text-muted" aria-live="polite">Works for <span className="font-medium tabular-nums text-fg">{clock(left)}</span></p>
            </>
          ) : shown ? (
            <>
              <p className="text-sm text-muted">That code has run out.</p>
              <button type="button" className="btn-primary" onClick={makeCode}>New code</button>
            </>
          ) : <p className="py-6 text-sm text-muted">Making a code…</p>}
        </div>
      ) : (
        <form onSubmit={redeem} className="space-y-4">
          <label className="field"><span>Their 6-digit code</span>
            <input value={entered} onChange={e => setEntered(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="off"
              placeholder="123456" className="text-center font-display text-2xl tracking-[0.3em] tabular-nums" aria-describedby="in-person-hint" />
          </label>
          <p id="in-person-hint" className="text-xs text-muted">It is on their screen, under Add in person.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={entered.length !== 6 || busy}>Add friend</button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
