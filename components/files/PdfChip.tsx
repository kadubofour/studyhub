'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, FileText, X } from 'lucide-react'
import { PdfViewer } from './PdfViewer'

function PdfOverlay({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (ref.current && !ref.current.open) ref.current.showModal() }, [])
  return (
    <dialog ref={ref} onClose={onClose} aria-label={name} className="m-0 h-dvh max-h-none w-screen max-w-none bg-bg p-0 text-fg">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-line px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{name}</h2>
          <a href={`${url}&download=${encodeURIComponent(name)}`} className="btn-ghost !px-2" aria-label="Download" title="Download"><Download size={16} aria-hidden /></a>
          <button type="button" className="btn-ghost !px-2" aria-label="Close" onClick={onClose}><X size={16} aria-hidden /></button>
        </div>
        <PdfViewer url={url} name={name} className="min-h-0 flex-1" />
      </div>
    </dialog>
  )
}

// A PDF named in a conversation: pressing it shows the PDF over the page, without leaving the app
export function PdfChip({ url, name, className }: { url: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <FileText size={14} aria-hidden className="text-muted" /><span className="truncate">{name}</span>
      </button>
      {open && <PdfOverlay url={url} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}
