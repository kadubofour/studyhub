'use client'
import { useEffect, useState } from 'react'
import { Check, Copy, Link2, RefreshCw, Share2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { supabase } from '@/lib/supabase/client'
import { reshareItem, shareItem, unshareItem, type ShareKind } from '@/lib/data/shares'

const WORDS: Record<ShareKind, string> = { deck: 'deck', note: 'note', notebook: 'notebook' }

function problem(e: unknown) {
  return e instanceof Error && e.message === 'rate_limited'
    ? 'Too many links made in the last hour. Try again later.'
    : "Couldn't make a link. Check your connection."
}

/**
 * The link to a deck, note or notebook. Mount it to open it (and make or read the link); onClose unmounts it.
 * Anyone with the link can view the item and copy it into their own Studyhub.
 */
export function ShareDialog({ kind, id, title, onClose }: { kind: ShareKind; id: string; title: string; onClose: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [token, setToken] = useState<string | null>(null)
  const [off, setOff] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  // what the last action did, said in the dialog too (a toast sits behind a modal); the next action clears it
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let current = true
    shareItem(supabase(), kind, id)
      .then(t => { if (current) setToken(t) })
      .catch(e => { if (current) setError(problem(e)) })
    return () => { current = false }
  }, [kind, id])

  const url = token ? `${location.origin}/s/${token}` : ''
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function run(make: () => Promise<void>) {
    setBusy(true); setError(null); setNotice('')
    try { await make() } catch (e) { setError(problem(e)) } finally { setBusy(false) }
  }
  async function copy() {
    setNotice('')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      setNotice('Link copied'); toast('Link copied')
    } catch { setError("Couldn't copy. Select the link and copy it.") }
  }
  async function send() {
    try { await navigator.share({ title, url }) } catch { /* closed without sharing */ }
  }
  const renew = () => run(async () => {
    setToken(await reshareItem(supabase(), kind, id))
    setNotice('New link made. The old one no longer works.'); toast('New link made. The old one no longer works.')
  })
  async function turnOff() {
    const ok = await confirm({
      title: 'Turn off this link?', body: 'People with the link will no longer see it. Copies they already made stay with them.',
      confirmLabel: 'Turn off link', danger: true,
    })
    if (!ok) return
    await run(async () => {
      await unshareItem(supabase(), kind, id)
      setToken(null); setOff(true)
      toast('Link turned off')
    })
  }
  const turnOn = () => run(async () => { setToken(await shareItem(supabase(), kind, id)); setOff(false) })

  return (
    <Dialog open onClose={onClose} title={`Share ${title || 'Untitled'}`} icon={Link2} size="md">
      <p className="mb-3 text-sm text-muted">Anyone with the link can view this {WORDS[kind]} and copy it into their own Studyhub.</p>
      {off ? (
        <p className="rounded-xl bg-surface px-3 py-3 text-sm">This link is off. Nobody can open it.</p>
      ) : token ? (
        <label className="field">
          <span>Link</span>
          <input type="text" readOnly aria-label="Link" value={url} onFocus={e => e.currentTarget.select()} />
        </label>
      ) : !error && <p className="text-sm text-muted" aria-live="polite">Making your link…</p>}
      <p role="status" className={notice ? 'mt-2 text-sm text-muted' : 'sr-only'}>{notice}</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <DialogFooter>
        {off ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={turnOn}>Turn on again</button>
        ) : token ? (
          <>
            <button type="button" className="btn-ghost hover:!text-danger" disabled={busy} onClick={turnOff}>Turn off link</button>
            <button type="button" className="btn" disabled={busy} onClick={renew}><RefreshCw size={14} aria-hidden />New link</button>
            {canShare && <button type="button" className="btn" onClick={send}><Share2 size={14} aria-hidden />Share</button>}
            <button type="button" className="btn-primary" onClick={copy}>{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}Copy link</button>
          </>
        ) : error ? (
          <button type="button" className="btn" disabled={busy} onClick={turnOn}>Try again</button>
        ) : null}
        <button type="button" className="btn" onClick={onClose}>Done</button>
      </DialogFooter>
    </Dialog>
  )
}
