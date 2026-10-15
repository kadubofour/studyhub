'use client'
import { useEffect, useId, useRef } from 'react'
import { X, type LucideIcon } from 'lucide-react'

const WIDTH = { sm: 'w-[min(92vw,420px)]', md: 'w-[min(94vw,560px)]', lg: 'w-[min(94vw,720px)]' }

/**
 * A modal. With an `icon` it gets the fuller header (icon tile, title, a line of help and a close button) used by Upload and
 * Scan; without one it is the plain titled box the smaller dialogs use. Put a DialogFooter last for the buttons.
 */
export function Dialog({ open, onClose, title, children, icon: Icon, subtitle, size = 'sm' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
  icon?: LucideIcon; subtitle?: string; size?: keyof typeof WIDTH
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={titleId}
      className={`m-auto ${WIDTH[size]} max-h-[92vh] overflow-y-auto overscroll-contain max-sm:mx-0 max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] rounded-2xl border border-line bg-bg p-5 text-fg shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[2px]`}>
      {Icon ? (
        <div className="mb-4 flex items-start gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-1 -mt-1 inline-flex size-8 pointer-coarse:size-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"><X size={17} aria-hidden /></button>
        </div>
      ) : (
        <h2 id={titleId} className="mb-4 text-base font-medium">{title}</h2>
      )}
      {children}
    </dialog>
  )
}

/** The buttons at the bottom of a dialog: kept in view while the content above scrolls */
export function DialogFooter({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="sticky -bottom-5 -mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur">
      {note && <div className="w-full text-xs text-muted sm:mr-auto sm:w-auto">{note}</div>}
      {children}
    </div>
  )
}
