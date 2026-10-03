'use client'
import { useState } from 'react'
import { getSummary, removeSummary, setSummary } from '@/lib/notes/summaryBlock'
import { wordCount } from '@/lib/ai/input'
import { MIN_WORDS } from '@/lib/ai/summary'
import { postAi } from '@/components/ai/aiFetch'

export function SummaryTab({ note, prepare, applyContent }: {
  note: { id: string; content_md: string }; prepare: () => Promise<void>; applyContent: (update: (current: string) => string) => void
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
    // Applied to the note as it is now, so anything typed while the AI worked is kept
    if (r.ok) { const summary = r.value.summary_md; applyContent(md => setSummary(md, summary)) }
    else setError(r.message)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{tooShort && !existing ? 'Too short to summarise yet. Add a bit more to this note first.' : existing ? 'This note has a summary at the top.' : 'Add a short summary to the top of this note.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy || tooShort} onClick={summarise}>
          {busy ? 'Summarising…' : existing ? '✦ Regenerate summary' : '✦ Summarise'}
        </button>
        {existing && <button type="button" className="btn" onClick={() => applyContent(removeSummary)}>Remove summary</button>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}
