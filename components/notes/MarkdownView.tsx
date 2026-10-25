'use client'
import { useContext, useEffect, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { remarkMarkup } from '@/lib/notes/markup'
import { supabase } from '@/lib/supabase/client'
import { isImageToken, makeImageResolver } from '@/lib/notes/images'
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
  if (!isImageToken(src)) return /^https?:\/\//i.test(src) ? <img src={src} alt={alt} className="max-w-full rounded-lg" /> : <span>{alt}</span>
  const url = got?.src === src ? got.url : null
  return url ? <img src={url} alt={alt} className="max-w-full rounded-lg" /> : <span className="text-muted" data-pending-image={got?.src === src ? undefined : 'true'}>{alt || 'Picture'}</span>
}

// Defined once: a new components object each render would make every picture start over
const COMPONENTS: Components = { img: ({ src, alt }) => <NotePicture src={typeof src === 'string' ? src : ''} alt={alt ?? ''} /> }

export function MarkdownView({ source, className = '' }: { source: string; className?: string }) {
  return (
    <div className={`prose-note ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkMarkup]} rehypePlugins={[rehypeKatex]} urlTransform={urlTransform}
        components={COMPONENTS}>{source}</ReactMarkdown>
    </div>
  )
}
