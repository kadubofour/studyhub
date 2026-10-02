'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, FileText, FileType2 } from 'lucide-react'
import { useToast } from '@/components/providers/ToastProvider'
import { exportNotesToWord, openPdfExport } from '@/lib/export/exportNotes'

/**
 * Export one note, a selection, or everything (ids omitted) as a Word document or PDF.
 * PDF opens a print-ready page where the browser's "Save as PDF" keeps math crisp and text selectable.
 */
export function ExportMenu({ ids, label = 'Export', fileName, disabled }: {
  ids?: string[]; label?: string; fileName?: string; disabled?: boolean
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Focus the first item when the menu opens (ARIA menu pattern)
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // preventDefault marks it handled, so the full-screen editor doesn't also close
      e.preventDefault(); e.stopPropagation(); setOpen(false); buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true) }
  }, [open])

  function onMenuKey(e: React.KeyboardEvent) {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    const to = e.key === 'ArrowDown' ? (i + 1) % items.length : e.key === 'ArrowUp' ? (i - 1 + items.length) % items.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null
    if (to === null) return
    e.preventDefault(); items[to]?.focus()
  }

  async function toWord() {
    setOpen(false); setBusy(true)
    try {
      if (!await exportNotesToWord(ids, fileName)) toast('There are no notes to export.')
    } catch {
      toast('Couldn\'t create the Word document.')
    } finally { setBusy(false) }
  }

  function toPdf() {
    setOpen(false)
    openPdfExport(ids)
  }

  return (
    <div ref={ref} className="relative">
      <button ref={buttonRef} type="button" className="btn" onClick={() => setOpen(o => !o)} disabled={disabled || busy} aria-haspopup="menu" aria-expanded={open}>
        <Download size={14} aria-hidden />{busy ? 'Preparing…' : label}
      </button>
      {open && (
        <div role="menu" onKeyDown={onMenuKey} className="menu-panel right-0 origin-top-right">
          <button role="menuitem" tabIndex={-1} className="menu-item" onClick={toWord}>
            <span className="menu-icon"><FileText size={15} aria-hidden /></span>Word document (.docx)
          </button>
          <button role="menuitem" tabIndex={-1} className="menu-item" onClick={toPdf}>
            <span className="menu-icon"><FileType2 size={15} aria-hidden /></span>PDF
          </button>
        </div>
      )}
    </div>
  )
}
