'use client'
import { useEffect, useId, useRef } from 'react'

export function Dialog({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
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
    <dialog ref={ref} onClose={onClose} aria-labelledby={titleId} className="m-auto w-[min(92vw,420px)] rounded-xl border border-line bg-bg p-5 text-fg backdrop:bg-black/40">
      <h2 id={titleId} className="mb-4 text-base font-medium">{title}</h2>
      {children}
    </dialog>
  )
}
