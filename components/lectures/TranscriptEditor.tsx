'use client'
import { useState } from 'react'
import { formatClock, type TranscriptLine } from '@/lib/lectures/time'

// Edit the transcript line by line; times stay as they are. Emptying a line removes it.
export function TranscriptEditor({ lines, onSave, onCancel }: {
  lines: TranscriptLine[]; onSave: (lines: TranscriptLine[]) => Promise<void>; onCancel: () => void
}) {
  const [draft, setDraft] = useState(lines)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true); setError(null)
    try {
      await onSave(draft.map(l => ({ ...l, text: l.text.trim() })).filter(l => l.text))
    } catch {
      setError('Couldn\'t save the transcript. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save transcript'}</button>
        <button type="button" className="btn" disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <ol className="max-h-[60vh] space-y-1 overflow-y-auto">
        {draft.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 pt-1.5 text-sm tabular-nums text-muted">{formatClock(l.start)}</span>
            <textarea aria-label={`Line at ${formatClock(l.start)}`} rows={2} className="input w-full text-sm" value={l.text}
              onChange={e => setDraft(d => d.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          </li>
        ))}
      </ol>
    </div>
  )
}
