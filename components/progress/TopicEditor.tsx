'use client'
import { useState } from 'react'
import { ArrowDown, ArrowUp, Trash2, X } from 'lucide-react'
import { addLink, addTopic, mergeTopics, moveTopic, removeLink, removeTopic, renameTopic, tidy } from '@/lib/topics/edit'
import { validateTopics } from '@/lib/topics/validate'
import type { CourseMaterial, TopicDraft, TopicLink } from '@/lib/topics/types'

type Row = TopicDraft & { key: string }
let seq = 0
const keyed = (t: TopicDraft): Row => ({ ...t, key: `r${++seq}` })

// Edits a course's whole topic list. Nothing is saved until the student presses Save.
export function TopicEditor({ initial, material, fresh, saving, error, onSave, onCancel }: {
  initial: TopicDraft[]; material: CourseMaterial; fresh: boolean; saving: boolean; error: string | null
  onSave: (list: TopicDraft[]) => void; onCancel: () => void
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(keyed))
  const [newName, setNewName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  // The helpers work on plain drafts; keep each row's key by position
  const apply = (fn: (l: TopicDraft[]) => TopicDraft[]) => {
    setProblem(null)
    setRows(rs => {
      const next = fn(rs)
      return next.map(t => rs.find(r => r === t) ?? ('key' in t ? (t as Row) : keyed(t)))
    })
  }

  const titleOf = (l: TopicLink) =>
    (l.kind === 'note' ? material.notes.find(n => n.id === l.id)?.title : l.kind === 'lecture' ? material.lectures.find(x => x.id === l.id)?.title : material.decks.find(d => d.id === l.id)?.name) ?? 'Removed item'
  const kindWord = { note: 'Note', lecture: 'Lecture', deck: 'Deck' } as const

  function save() {
    const list = tidy(rows.map(({ key: _key, ...t }) => t))
    const why = validateTopics(list)
    if (why) { setProblem(why); return }
    onSave(list)
  }

  return (
    <div className="space-y-3">
      {fresh && <p role="status" className="rounded-xl bg-accent-soft p-2 text-sm">Drafted by AI. Nothing is saved until you press Save.</p>}
      <ul className="space-y-3">
        {rows.map((t, i) => {
          const name = t.name.trim() || 'this topic'
          const free = [
            ...material.notes.map(n => ({ kind: 'note' as const, id: n.id, label: n.title })),
            ...material.lectures.map(x => ({ kind: 'lecture' as const, id: x.id, label: x.title })),
            ...material.decks.map(d => ({ kind: 'deck' as const, id: d.id, label: d.name })),
          ].filter(m => !t.links.some(l => l.kind === m.kind && l.id === m.id))
          return (
            <li key={t.key} className="space-y-2 rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input className="input min-w-40 flex-1" aria-label={`Topic ${i + 1} name`} maxLength={200} value={t.name} onChange={e => apply(l => renameTopic(l, i, e.target.value))} />
                <button type="button" className="btn-ghost" aria-label={`Move ${name} up`} onClick={() => apply(l => moveTopic(l, i, -1))}><ArrowUp size={15} aria-hidden /></button>
                <button type="button" className="btn-ghost" aria-label={`Move ${name} down`} onClick={() => apply(l => moveTopic(l, i, 1))}><ArrowDown size={15} aria-hidden /></button>
                <button type="button" className="btn-ghost text-danger" aria-label={`Delete ${name}`} onClick={() => apply(l => removeTopic(l, i))}><Trash2 size={15} aria-hidden /></button>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {t.links.map(l => (
                  <li key={`${l.kind}:${l.id}`} className="flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-xs">
                    <span className="text-muted">{kindWord[l.kind]}</span>{titleOf(l)}
                    <button type="button" aria-label={`Remove ${titleOf(l)} from ${name}`} className="text-muted hover:text-fg" onClick={() => apply(x => removeLink(x, i, l))}><X size={12} aria-hidden /></button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <select className="input max-w-52" aria-label={`Add to ${name}`} value="" onChange={e => {
                  const [kind, id] = e.target.value.split(':') as [TopicLink['kind'], string]
                  if (kind && id) apply(l => addLink(l, i, { kind, id }))
                }}>
                  <option value="">Add material…</option>
                  {(['note', 'lecture', 'deck'] as const).map(k => {
                    const group = free.filter(m => m.kind === k)
                    return group.length ? <optgroup key={k} label={`${kindWord[k]}s`}>{group.map(m => <option key={m.id} value={`${k}:${m.id}`}>{m.label}</option>)}</optgroup> : null
                  })}
                </select>
                {rows.length > 1 && (
                  <select className="input max-w-44" aria-label={`Merge ${name} into`} value="" onChange={e => {
                    const into = rows.findIndex(r => r.id === e.target.value || r.key === e.target.value)
                    if (into >= 0) apply(l => mergeTopics(l, i, into))
                  }}>
                    <option value="">Merge into…</option>
                    {rows.map((r, j) => j !== i && <option key={r.key} value={r.id ?? r.key}>{r.name.trim() || 'Untitled'}</option>)}
                  </select>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex gap-2">
        <input className="input flex-1" aria-label="New topic name" placeholder="Add a topic" value={newName} maxLength={200}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { e.preventDefault(); apply(l => addTopic(l, newName)); setNewName('') } }} />
        <button type="button" className="btn" onClick={() => { if (newName.trim()) { apply(l => addTopic(l, newName)); setNewName('') } }}>Add topic</button>
      </div>
      {(problem || error) && <p role="alert" className="text-sm text-danger">{problem ?? error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save topics'}</button>
      </div>
    </div>
  )
}
