'use client'
import { ArrowLeft, ArrowRight, Camera, FileText, X } from 'lucide-react'
import type { ScanPage } from '@/lib/scan/scanClient'

// Numbered page tiles: move earlier/later, retake (photos) and remove
export function ScanPages({ pages, onMove, onRetake, onRemove }: {
  pages: ScanPage[]; onMove: (i: number, by: -1 | 1) => void; onRetake: (i: number) => void; onRemove: (i: number) => void
}) {
  return (
    <ol className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto" aria-label="Pages">
      {pages.map((p, i) => (
        <li key={p.id} className="relative overflow-hidden rounded-xl border border-line bg-surface">
          {p.preview
            // eslint-disable-next-line @next/next/no-img-element -- a local photo preview (blob URL)
            ? <img src={p.preview} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
            : (
              <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted">
                <FileText size={20} aria-hidden />
                <span className="line-clamp-2 break-all">{p.file.name}</span>
                {p.kind === 'pdf' && <span>{p.pages} page{p.pages === 1 ? '' : 's'}</span>}
              </div>
            )}
          <span className="absolute left-1 top-1 rounded-md bg-raised/90 px-1.5 text-[11px] font-medium">{i + 1}</span>
          {p.preview && <span className="sr-only">{p.file.name}</span>}
          <div className="flex justify-between border-t border-line bg-raised p-0.5">
            <button type="button" className="btn-ghost size-8 justify-center p-0" aria-label={`Move page ${i + 1} earlier`} disabled={i === 0} onClick={() => onMove(i, -1)}><ArrowLeft size={14} aria-hidden /></button>
            {p.kind === 'image' && <button type="button" className="btn-ghost size-8 justify-center p-0" aria-label={`Retake page ${i + 1}`} onClick={() => onRetake(i)}><Camera size={14} aria-hidden /></button>}
            <button type="button" className="btn-ghost size-8 justify-center p-0" aria-label={`Remove page ${i + 1}`} onClick={() => onRemove(i)}><X size={14} aria-hidden /></button>
            <button type="button" className="btn-ghost size-8 justify-center p-0" aria-label={`Move page ${i + 1} later`} disabled={i === pages.length - 1} onClick={() => onMove(i, 1)}><ArrowRight size={14} aria-hidden /></button>
          </div>
        </li>
      ))}
    </ol>
  )
}
