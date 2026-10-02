'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

import { wrap } from './findInNote'

/**
 * Find-in-note bar. `search(query, index)` highlights match `wrap(index, count)` and returns
 * how many matches there are; the editor that owns the text decides how to show them.
 */
export function FindBar({ search, onClose }: { search: (query: string, index: number) => number; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)

  function go(q: string, i: number) {
    const n = search(q, i)
    setCount(n)
    setIndex(wrap(i, n))
  }

  return (
    <div role="search" aria-label="Find in note" className="no-print flex items-center gap-1 rounded-xl border border-line bg-raised px-2 py-1 shadow-sm">
      <input type="search" autoFocus className="w-44 bg-transparent px-1 text-sm outline-none" placeholder="Find in note" aria-label="Find in note"
        value={query}
        onChange={e => { setQuery(e.target.value); go(e.target.value, 0) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); go(query, index + (e.shiftKey ? -1 : 1)) }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
        }} />
      <span className="min-w-14 text-right text-xs tabular-nums text-muted" aria-live="polite">
        {query ? (count ? `${index + 1} of ${count}` : 'No matches') : ''}
      </span>
      <button type="button" className="rounded p-1 text-muted hover:text-fg disabled:opacity-40" aria-label="Previous match" disabled={!count} onClick={() => go(query, index - 1)}><ChevronUp size={15} aria-hidden /></button>
      <button type="button" className="rounded p-1 text-muted hover:text-fg disabled:opacity-40" aria-label="Next match" disabled={!count} onClick={() => go(query, index + 1)}><ChevronDown size={15} aria-hidden /></button>
      <button type="button" className="rounded p-1 text-muted hover:text-fg" aria-label="Close find" onClick={onClose}><X size={15} aria-hidden /></button>
    </div>
  )
}
