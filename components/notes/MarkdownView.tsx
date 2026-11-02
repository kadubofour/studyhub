'use client'
import { Children, useContext, useEffect, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { remarkMarkup } from '@/lib/notes/markup'
import { supabase } from '@/lib/supabase/client'
import { isImageToken, makeImageResolver } from '@/lib/notes/images'
import { useIsDiagram } from '@/lib/notes/diagramLook'
import { NoteImagesContext } from './NoteImagesContext'

// react-markdown drops addresses it does not know, so a studyhub-image: token is let through here and drawn from its signed link
const urlTransform = (url: string) => (isImageToken(url) || /^(https?:|mailto:|#|\/)/i.test(url) ? url : '')

// Pictures come from short-lived signed links, which next/image cannot optimise
/* eslint-disable @next/next/no-img-element */
// One resolver per signed-in student, so pictures share its cache of signed links
let shared: { id: string; resolve: (src: string) => Promise<string | null> } | null = null
async function resolverFor() {
  const sb = supabase()
  const id = (await sb.auth.getSession()).data.session?.user.id
  if (!id) return null
  if (shared?.id !== id) shared = { id, resolve: makeImageResolver(sb, id) }
  return shared.resolve
}

// A page can say how its pictures are reached (a shared page draws them through its link); otherwise from the student's own folder
function NotePicture({ src, alt }: { src: string; alt: string }) {
  const ctx = useContext(NoteImagesContext)
  const [got, setGot] = useState<{ src: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!isImageToken(src)) return
    let live = true
    const find = ctx ? Promise.resolve(ctx.resolve) : resolverFor()
    find
      .then(resolve => (resolve ? resolve(src) : null))
      .then(url => { if (live) setGot({ src, url }) })
      .catch(() => { if (live) setGot({ src, url: null }) })
    return () => { live = false }
  }, [src, ctx])
  const url = got?.src === src ? got.url : null
  const diagram = useIsDiagram(src, url)
  if (!isImageToken(src)) return /^https?:\/\//i.test(src) ? <img src={src} alt={alt} className="max-w-full rounded-lg" /> : <span>{alt}</span>
  // a drawn figure from an import carries its caption as its alt text; it is shown under it (a picture with a file name for alt is not)
  if (url && diagram && isCaption(alt)) return <span className="block"><img src={url} alt={alt} data-diagram="true" className="max-w-full rounded-lg" /><span className="figure-caption">{alt}</span></span>
  return url ? <img src={url} alt={alt} data-diagram={diagram || undefined} className="max-w-full rounded-lg" /> : <span className="text-muted" data-pending-image={got?.src === src ? undefined : 'true'}>{alt || 'Picture'}</span>
}

// A caption is words (at least two, not a file name); "cell" or "IMG_2041.png" is only a name
export const isCaption = (alt: string) => /\s/.test(alt.trim()) && !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(alt.trim())
// The mark that ends a proof, alone in its paragraph
export const isProofMark = (text: string) => /^[■□∎▪◼]$/.test(text.trim())

// Defined once: a new components object each render would make every picture start over
const COMPONENTS: Components = {
  img: ({ src, alt }) => <NotePicture src={typeof src === 'string' ? src : ''} alt={alt ?? ''} />,
  p: ({ children }) => {
    const parts = Children.toArray(children)
    return parts.length === 1 && typeof parts[0] === 'string' && isProofMark(parts[0])
      ? <p className="end-of-proof" aria-label="End of proof">{parts[0]}</p>
      : <p>{children}</p>
  },
}

export function MarkdownView({ source, className = '' }: { source: string; className?: string }) {
  return (
    <div className={`prose-note ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkMarkup]} rehypePlugins={[rehypeKatex]} urlTransform={urlTransform}
        components={COMPONENTS}>{source}</ReactMarkdown>
    </div>
  )
}
