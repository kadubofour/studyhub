'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { SummaryTab } from './SummaryTab'
import { CardsTab } from './CardsTab'

type Tab = 'summary' | 'cards'
const TABS: [Tab, string][] = [['summary', 'Summary'], ['cards', 'Cards']]

// Beside the note on wide screens, a sheet from the bottom on phones
export function StudyPanel({ note, onClose, prepare, applyContent }: {
  note: { id: string; title: string; content_md: string }
  onClose: () => void; prepare: () => Promise<void>; applyContent: (md: string) => void
}) {
  const [tab, setTab] = useState<Tab>('summary')
  return (
    <aside aria-label="Study" className="no-print fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-line bg-raised p-4 shadow-lg md:inset-x-auto md:bottom-0 md:right-0 md:top-[49px] md:max-h-none md:w-[360px] md:rounded-none md:border-y-0 md:border-r-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">✦ Study</h2>
        <button type="button" className="btn-ghost" aria-label="Close study panel" onClick={onClose}><X size={16} aria-hidden /></button>
      </div>
      <div role="tablist" aria-label="Study tools" className="mb-4 flex gap-1 rounded-xl bg-surface p-0.5">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-2 py-1 text-sm ${tab === id ? 'bg-raised font-medium shadow-sm' : 'text-muted'}`}>{label}</button>
        ))}
      </div>
      {tab === 'summary' && <SummaryTab note={note} prepare={prepare} applyContent={applyContent} />}
      {tab === 'cards' && <CardsTab note={note} prepare={prepare} />}
    </aside>
  )
}
