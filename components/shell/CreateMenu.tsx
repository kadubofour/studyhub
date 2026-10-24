'use client'
import { useEffect, useRef } from 'react'
import { BellPlus, FilePlus, Layers, ListPlus, Mic, ScanLine, Upload, type LucideIcon } from 'lucide-react'

export type CreateAction = 'new-note' | 'new-deck' | 'record' | 'new-task' | 'new-reminder' | 'upload' | 'scan'
const ITEMS: { id: CreateAction; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'new-note', label: 'New note', hint: 'Write it here', icon: FilePlus },
  { id: 'new-deck', label: 'New deck', hint: 'Flashcards', icon: Layers },
  { id: 'record', label: 'Record lecture', hint: 'Transcribed as you go', icon: Mic },
  { id: 'new-task', label: 'New task', hint: 'In the Planner', icon: ListPlus },
  { id: 'new-reminder', label: 'New reminder', hint: 'At a time you choose', icon: BellPlus },
  { id: 'upload', label: 'Upload', hint: 'A PDF, slides or a document', icon: Upload },
  { id: 'scan', label: 'Scan', hint: 'Photos of pages', icon: ScanLine },
]

// Everything that makes something, from the + in the rail (opens beside it) or in the phone dock (opens above it).
export function CreateMenu({ from, onPick, onClose }: { from: 'rail' | 'wide' | 'dock'; onPick: (a: CreateAction) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const away = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [onClose])
  const move = (e: React.KeyboardEvent) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
  }
  // From the phone dock it is a sheet over a dimmed page, with large tiles; from the sidebar, a short list beside it
  const sheet = from === 'dock'
  return (
    <>
      {sheet && <div data-create-backdrop aria-hidden className="create-in fixed inset-0 z-40 bg-black/45" />}
      <div ref={ref} role="menu" aria-label="Create" onKeyDown={move}
        className={sheet
          ? 'create-in fixed inset-x-3 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-50 mx-auto grid max-w-md grid-cols-2 gap-2 rounded-3xl border border-line p-3 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.45)]'
          : `glass create-in fixed z-50 w-72 rounded-2xl p-1.5 ${from === 'rail' ? 'left-[84px] top-16' : 'left-[272px] top-16'}`}
        style={{ background: 'var(--glass-strong)' }}>
        {ITEMS.map(({ id, label, hint, icon: Icon }) => (
          <button key={id} type="button" role="menuitem" aria-label={label} onClick={() => { onClose(); onPick(id) }}
            className={sheet
              ? 'flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl bg-surface p-3.5 text-left outline-none transition active:scale-[.98] focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]'
              : 'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition hover:bg-accent-soft focus-visible:bg-accent-soft'}>
            <span aria-hidden className={`grid shrink-0 place-items-center text-accent ${sheet ? 'size-10 rounded-xl bg-raised' : 'size-9 rounded-[10px] bg-surface'}`}><Icon size={sheet ? 19 : 17} /></span>
            <span className="min-w-0"><span className="block text-[15px] font-medium">{label}</span><span aria-hidden className="block text-xs text-muted">{hint}</span></span>
          </button>
        ))}
      </div>
    </>
  )
}
