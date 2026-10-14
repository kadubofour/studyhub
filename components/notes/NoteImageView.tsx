'use client'
import { useContext, useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Trash2 } from 'lucide-react'
import { NoteImagesContext } from './NoteImagesContext'
import { isImageToken } from '@/lib/notes/images'

/* eslint-disable @next/next/no-img-element -- signed links, not optimisable by next/image */
const isWeb = (src: string) => /^https?:\/\//i.test(src)

// A picture in a note: drawn from its address once that is known, with Remove on it while it is selected or has focus.
// Focus is used as well as the editor's own selection because the browser moves the editor's selection off a clicked picture.
// A picture that cannot be reached, or whose address is not one of ours or a web address, shows its description instead.
export function NoteImageView({ node, selected, deleteNode }: NodeViewProps) {
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
  const box = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const shown = selected || focused

  return (
    <NodeViewWrapper className="my-3 select-none" data-note-image>
      <div ref={box} role="group" tabIndex={0} aria-label={alt ? `Picture: ${alt}` : 'Picture'} className="relative inline-block max-w-full rounded-lg outline-none"
        onClick={() => box.current?.focus()} onFocus={() => setFocused(true)}
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false) }}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); deleteNode() }
        }}>
        {url
          ? <img src={url} alt={alt} draggable={false} className={`max-w-full rounded-lg ${shown ? 'ring-2 ring-[var(--accent-solid)]' : ''}`} />
          : <div className="rounded-lg bg-surface px-4 py-8 text-sm text-muted">{alt || 'Picture'}</div>}
        {shown && (
          <div contentEditable={false} className="absolute right-2 top-2 flex gap-1 rounded-xl border border-line bg-raised p-1 shadow-md">
            <button type="button" aria-label="Remove picture" onClick={() => deleteNode()} className="inline-flex size-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-danger"><Trash2 size={14} aria-hidden /></button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
