'use client'
import { useContext, useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { PenLine, Trash2 } from 'lucide-react'
import { NoteImagesContext } from './NoteImagesContext'
import { isImageToken } from '@/lib/notes/images'

const isWeb = (src: string) => /^https?:\/\//i.test(src)

// A picture in a note: drawn from its address once that is known, with Markup and Remove on it while it is selected.
// A picture that cannot be reached, or whose address is not one of ours or a web address, shows its description instead.
export function NoteImageView({ node, selected, deleteNode, getPos }: NodeViewProps) {
  const ctx = useContext(NoteImagesContext)
  const src = String(node.attrs.src ?? '')
  const alt = String(node.attrs.alt ?? '')
  const safe = isImageToken(src) || isWeb(src)
  const [got, setGot] = useState<{ src: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!safe || !ctx) return
    let live = true
    ctx.resolve(src).then(url => { if (live) setGot({ src, url }) }).catch(() => { if (live) setGot({ src, url: null }) })
    return () => { live = false }
  }, [src, ctx, safe])
  const url = safe && got?.src === src ? got.url : null
  const markup = () => { const pos = getPos(); if (pos !== undefined) ctx?.onMarkup?.({ pos, src, alt }) }

  return (
    <NodeViewWrapper className="my-3" data-note-image>
      <div className="relative inline-block max-w-full">
        {url
          ? <img src={url} alt={alt} draggable={false} onDoubleClick={markup} className={`max-w-full rounded-lg ${selected ? 'ring-2 ring-[var(--accent-solid)]' : ''}`} />
          : <div className="rounded-lg bg-surface px-4 py-8 text-sm text-muted">{alt || 'Picture'}</div>}
        {selected && (
          <div contentEditable={false} className="absolute right-2 top-2 flex gap-1 rounded-xl border border-line bg-raised p-1 shadow-md">
            {ctx?.onMarkup && <button type="button" onClick={markup} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium hover:bg-surface"><PenLine size={14} aria-hidden />Markup</button>}
            <button type="button" aria-label="Remove picture" onClick={() => deleteNode()} className="inline-flex size-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-danger"><Trash2 size={14} aria-hidden /></button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
