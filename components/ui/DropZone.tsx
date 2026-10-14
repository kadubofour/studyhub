'use client'
import { useRef, useState } from 'react'

/**
 * A panel that takes files dropped on it. It does not open the file picker itself: put the buttons that do inside it.
 * `onFiles` gets everything dropped; the page around it is not navigated to the file.
 */
export function DropZone({ onFiles, disabled = false, label, className = '', children }: {
  onFiles: (files: File[]) => void; disabled?: boolean; label: string; className?: string; children: React.ReactNode
}) {
  const [over, setOver] = useState(false)
  const depth = useRef(0) // dragenter/leave fire for every child, so the highlight follows a count
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
  return (
    <div role="group" aria-label={label} data-dragging={over ? 'true' : 'false'}
      onDragEnter={e => { if (disabled || !hasFiles(e)) return; e.preventDefault(); depth.current++; setOver(true) }}
      onDragOver={e => { if (disabled || !hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDragLeave={e => { if (disabled || !hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false) }}
      onDrop={e => {
        if (disabled || !hasFiles(e)) return
        e.preventDefault(); depth.current = 0; setOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onFiles(files)
      }}
      className={`rounded-2xl border-2 border-dashed transition ${over ? 'border-accent bg-accent-soft' : 'border-line bg-surface/50'} ${className}`}>
      {children}
    </div>
  )
}
