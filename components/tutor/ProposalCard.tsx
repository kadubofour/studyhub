'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MarkdownView } from '@/components/notes/MarkdownView'
import type { Proposal } from '@/lib/ai/tutorTools'

const LINK = { note: (id: string) => `/notes/${id}`, deck: (id: string) => `/flashcards/${id}`, quiz: (id: string) => `/quiz/${id}`, task: () => '/planner', class: () => '/planner', notebook: (id: string) => `/notebooks/${id}` }

// What the tutor wants to save, shown before anything is saved. The student can fix wording first.
export function ProposalCard({ proposal, onAdd, onDiscard }: { proposal: Proposal; onAdd: (edited: Proposal) => Promise<void>; onDiscard: () => void }) {
  const [draft, setDraft] = useState<Proposal>(proposal)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  if (proposal.state === 'discarded') return <p className="text-xs text-muted">Discarded</p>
  if (proposal.state === 'added') {
    return (
      <p className="text-sm">
        <span className="text-muted">Added · </span>
        {proposal.itemKind && <Link className="text-accent" href={LINK[proposal.itemKind](proposal.itemId ?? '')}>Open</Link>}
      </p>
    )
  }

  async function add() {
    setBusy(true); setError(false)
    try { await onAdd(draft) } catch { setError(true) } finally { setBusy(false) }
  }

  let body: React.ReactNode
  if (draft.tool === 'create_note') {
    const d = draft
    body = (
      <>
        <p className="section-label">Note</p>
        <input className="input w-full" aria-label="Note title" maxLength={200} value={d.args.title} onChange={e => setDraft({ ...d, args: { ...d.args, title: e.target.value } })} />
        <div className="max-h-48 overflow-y-auto rounded-lg border border-line p-2 text-sm"><MarkdownView source={d.args.body} /></div>
      </>
    )
  } else if (draft.tool === 'create_flashcards') {
    const d = draft
    const setCard = (i: number, patch: Partial<{ front: string; back: string }>) =>
      setDraft({ ...d, args: { ...d.args, cards: d.args.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) } })
    body = (
      <>
        <p className="section-label">{d.args.cards.length} flashcard{d.args.cards.length === 1 ? '' : 's'} for “{d.args.deck_name ?? 'your deck'}”</p>
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {d.args.cards.map((c, i) => (
            <li key={i} className="grid gap-1 sm:grid-cols-2">
              <textarea className="input" rows={2} aria-label={`Card ${i + 1} front`} value={c.front} onChange={e => setCard(i, { front: e.target.value })} />
              <textarea className="input" rows={2} aria-label={`Card ${i + 1} back`} value={c.back} onChange={e => setCard(i, { back: e.target.value })} />
            </li>
          ))}
        </ul>
      </>
    )
  } else if (draft.tool === 'create_quiz') {
    const d = draft
    body = (
      <>
        <p className="section-label">Quiz · {d.args.questions.length} questions</p>
        <input className="input w-full" aria-label="Quiz title" maxLength={200} value={d.args.title} onChange={e => setDraft({ ...d, args: { ...d.args, title: e.target.value } })} />
        <ol className="max-h-48 list-decimal space-y-1 overflow-y-auto pl-5 text-sm">
          {d.args.questions.map(q => <li key={q.id}>{q.prompt} <span className="text-muted">→ {q.answer}</span></li>)}
        </ol>
      </>
    )
  } else if (draft.tool === 'create_class') {
    const d = draft
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    body = (
      <>
        <p className="section-label">Class · {d.args.kind}</p>
        <p className="text-sm">{DAYS[d.args.day_of_week]}, {d.args.start_time} to {d.args.end_time}</p>
        <input className="input w-full" aria-label="Class location" maxLength={100} placeholder="Where (optional)" value={d.args.location ?? ''} onChange={e => setDraft({ ...d, args: { ...d.args, location: e.target.value || null } })} />
      </>
    )
  } else if (draft.tool === 'create_notebook') {
    const d = draft
    body = (
      <>
        <p className="section-label">Notebook</p>
        <input className="input w-full" aria-label="Notebook name" maxLength={80} value={d.args.name} onChange={e => setDraft({ ...d, args: { ...d.args, name: e.target.value } })} />
      </>
    )
  } else {
    const d = draft
    body = (
      <>
        <p className="section-label">Task · {d.args.type}</p>
        <input className="input w-full" aria-label="Task title" maxLength={300} value={d.args.title} onChange={e => setDraft({ ...d, args: { ...d.args, title: e.target.value } })} />
        <p className="text-xs text-muted">{d.args.due_at ? `Due ${new Date(/^\d{4}-\d{2}-\d{2}$/.test(d.args.due_at) ? `${d.args.due_at}T12:00:00` : d.args.due_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No due date'}</p>
      </>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
      {body}
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Add'}</button>
        <button type="button" className="btn" disabled={busy} onClick={onDiscard}>Discard</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">Couldn&apos;t add that. Try again.</p>}
    </div>
  )
}
