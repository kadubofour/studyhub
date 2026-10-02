'use client'
import { useEffect, useRef, useState } from 'react'

const ROWS = 8
const COLS = 10

/** Word-style table size picker: hover (or arrow) over the grid, click (or Enter) to insert. */
export function TableGridPicker({ onPick, onCancel, autoFocus }: {
  onPick: (rows: number, cols: number) => void; onCancel?: () => void; autoFocus?: boolean
}) {
  const [at, setAt] = useState({ r: 1, c: 1 })
  const [hovering, setHovering] = useState(false)
  const grid = useRef<HTMLDivElement>(null)
  const cell = (r: number, c: number) => grid.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)

  useEffect(() => { if (autoFocus) cell(1, 1)?.focus() }, [autoFocus])

  function onKey(e: React.KeyboardEvent) {
    const move = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key]
    if (move) {
      e.preventDefault(); e.stopPropagation()
      const r = Math.min(ROWS, Math.max(1, at.r + move[0]))
      const c = Math.min(COLS, Math.max(1, at.c + move[1]))
      setAt({ r, c }); setHovering(true)
      cell(r, c)?.focus()
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault(); e.stopPropagation(); onCancel()
    }
  }

  return (
    <div className="p-1.5">
      <div ref={grid} className="grid w-max gap-[3px]" style={{ gridTemplateColumns: `repeat(${COLS}, 1rem)` }}
        onKeyDown={onKey} onMouseLeave={() => setHovering(false)}>
        {Array.from({ length: ROWS }, (_, i) => Array.from({ length: COLS }, (_, j) => {
          const r = i + 1, c = j + 1
          const lit = hovering && r <= at.r && c <= at.c
          return (
            <button key={`${r}-${c}`} type="button" data-cell={`${r}-${c}`} data-lit={lit}
              tabIndex={r === at.r && c === at.c ? 0 : -1} aria-label={`${r} by ${c} table`}
              className={`size-4 rounded-[4px] border outline-none focus-visible:ring-2 focus-visible:ring-accent ${lit ? 'border-accent-solid bg-accent-solid/30' : 'border-line bg-raised hover:border-accent'}`}
              onMouseEnter={() => { setAt({ r, c }); setHovering(true) }}
              onFocus={() => { setAt({ r, c }); setHovering(true) }}
              onClick={() => onPick(r, c)} />
          )
        }))}
      </div>
      <p className="mt-2 text-center text-xs text-muted" aria-live="polite">{hovering ? `${at.r} × ${at.c} table` : 'Insert table'}</p>
    </div>
  )
}
