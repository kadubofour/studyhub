'use client'
import { useState } from 'react'
import { formatClock, lineAt, searchLines, type TranscriptLine } from '@/lib/lectures/time'

// Timestamped lines: tap one to play from there; the line being spoken is highlighted; search filters
export function TranscriptView({ lines, currentTime, onSeek }: { lines: TranscriptLine[]; currentTime: number; onSeek: (t: number) => void }) {
  const [q, setQ] = useState('')
  const matches = q.trim() ? searchLines(lines, q) : null
  const shown = matches ?? lines.map((_, i) => i)
  const active = lineAt(lines, currentTime)
  return (
    <div className="space-y-2">
      <input aria-label="Search transcript" placeholder="Search transcript" className="input w-full" value={q} onChange={e => setQ(e.target.value)} />
      {matches && <p className="text-xs text-muted">{matches.length} match{matches.length === 1 ? '' : 'es'}</p>}
      <ol className="max-h-[60vh] space-y-0.5 overflow-y-auto">
        {shown.map(i => (
          <li key={i}>
            <button type="button" aria-current={i === active ? 'true' : undefined} onClick={() => onSeek(lines[i].start)}
              className={`flex w-full gap-2 rounded-lg px-2 py-1 text-left text-sm ${i === active ? 'bg-accent-soft' : 'hover:bg-surface'}`}>
              <span className="shrink-0 tabular-nums text-muted">{formatClock(lines[i].start)}</span>{' '}
              <span>{lines[i].text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
