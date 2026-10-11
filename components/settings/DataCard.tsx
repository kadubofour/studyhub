'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/components/ui/Dialog'
import { supabase } from '@/lib/supabase/client'
import { exportMyData } from '@/lib/account/export'

const WORD = 'DELETE'
const MESSAGE: Record<string, string> = {
  unavailable: 'Deleting accounts is not available right now. Try again later.',
}

// Settings: take your data out, or leave and take it all with you
export function DataCard({ now = () => new Date() }: { now?: () => Date }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [asking, setAsking] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deletingRef = useRef(false)

  async function download() {
    setBusy(true); setNote(null)
    try {
      const data = await exportMyData(supabase(), now())
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      // The link is put on the page for the click (iOS Safari ignores a loose one) and the file is kept a moment, while the browser reads it
      const a = document.createElement('a')
      a.href = url
      a.download = `studyhub-data-${now().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url) }, 1000)
      setNote({ kind: 'ok', text: 'Your data was downloaded.' })
    } catch (e) {
      setNote({ kind: 'error', text: e instanceof Error ? e.message : 'Could not download your data. Try again.' })
    } finally { setBusy(false) }
  }

  async function remove() {
    if (typed !== WORD || deletingRef.current) return
    deletingRef.current = true; setDeleting(true); setDeleteError(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: WORD }) })
      if (res.ok) { router.replace('/'); router.refresh(); return }
      const body = await res.json().catch(() => ({})) as { error?: string }
      setDeleteError(MESSAGE[body.error ?? ''] ?? 'Could not finish deleting your account. Some files may already be gone. Try again, and if it keeps failing, contact support.')
    } catch {
      setDeleteError('Could not finish deleting. Your account is still active; try again.')
    }
    deletingRef.current = false; setDeleting(false)
  }

  function close() { setAsking(false); setTyped(''); setDeleteError(null) }

  return (
    <section className="card space-y-3" aria-labelledby="data-title">
      <h2 id="data-title" className="text-base font-semibold">Your data</h2>
      <div className="space-y-1">
        <p className="text-sm text-muted">Download everything in your account (notes, cards, tasks, quizzes, lecture transcripts, tutor chats and more) as one file. Lecture audio is not included.</p>
        <button type="button" className="btn" disabled={busy} onClick={() => { void download() }}>{busy ? 'Preparing…' : 'Download my data'}</button>
        <p role="status" className="text-sm text-muted">{note?.kind === 'ok' ? note.text : ''}</p>
        {note?.kind === 'error' && <p role="alert" className="text-sm text-danger">{note.text}</p>}
      </div>
      <div className="space-y-1 border-t border-line pt-3">
        <p className="text-sm text-muted">Deleting your account removes your sign-in, everything in it, your lecture audio and uploaded files, and turns off any subscription renewal.</p>
        <button type="button" className="btn text-danger" onClick={() => setAsking(true)}>Delete my account</button>
      </div>
      <Dialog open={asking} onClose={close} title="Delete your account?">
        <div className="space-y-3">
          <p className="text-sm">This can&apos;t be undone. Your notes, flashcards, tasks, quizzes, lectures, chats and progress will be gone for good, and any Premium time you have paid for is lost. Download your data first if you want a copy.</p>
          <label className="field"><span>Type DELETE to confirm</span>
            <input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
          </label>
          {deleteError && <p role="alert" className="text-sm text-danger">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={close}>Keep my account</button>
            <button type="button" className="btn-danger" disabled={typed !== WORD || deleting} onClick={() => { void remove() }}>{deleting ? 'Deleting…' : 'Delete everything'}</button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}
