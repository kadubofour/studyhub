'use client'
import { useState } from 'react'
import { getSummary, removeSummary, setSummary } from '@/lib/notes/summaryBlock'
import { wordCount } from '@/lib/ai/input'
import { MIN_WORDS } from '@/lib/ai/summary'
import { postAi } from '@/components/ai/aiFetch'

export function SummaryTab({ note, prepare, applyContent }: {
  note: { id: string; content_md: string }; prepare: () => Promise<void>; applyContent: (md: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const existing = getSummary(note.content_md)
  // Same threshold as the server, so the button is off instead of failing after a click
  const tooShort = wordCount(removeSummary(note.content_md)) < MIN_WORDS

  async function summarise() {
    setBusy(true); setError(null)
    await prepare() // the server reads the saved note, so save pending edits first
    const r = await postAi<{ summary_md: string }>('/api/ai/summary', { noteId: note.id })
    setBusy(false)
    if (r.ok) applyContent(setSummary(note.content_md, r.value.summary_md))
    else setError(r.message)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{tooShort && !existing ? 'Too short to summarise yet. Add a bit more to this note first.' : existing ? 'This note has a summary at the top.' : 'Add a short summary to the top of this note.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy || tooShort} onClick={summarise}>
          {busy ? 'Summarising…' : existing ? '✦ Regenerate summary' : '✦ Summarise'}
        </button>
        {existing && <button type="button" className="btn" onClick={() => applyContent(removeSummary(note.content_md))}>Remove summary</button>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}
