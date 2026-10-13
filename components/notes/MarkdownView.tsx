'use client'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { supabase } from '@/lib/supabase/client'
import { isImageToken, makeImageResolver } from '@/lib/notes/images'

// react-markdown drops addresses it does not know, so a studyhub-image: token is let through here and drawn from its signed link
const urlTransform = (url: string) => (isImageToken(url) || /^(https?:|mailto:|#|\/)/i.test(url) ? url : '')

// Pictures come from short-lived signed links, which next/image cannot optimise
/* eslint-disable @next/next/no-img-element */
function NotePicture({ src, alt }: { src: string; alt: string }) {
  const [got, setGot] = useState<{ src: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!isImageToken(src)) return
    let live = true
    const sb = supabase()
    sb.auth.getUser()
      .then(({ data }) => (data.user ? makeImageResolver(sb, data.user.id)(src) : null))
      .then(url => { if (live) setGot({ src, url }) })
      .catch(() => { if (live) setGot({ src, url: null }) })
    return () => { live = false }
  }, [src])
  if (!isImageToken(src)) return /^https?:\/\//i.test(src) ? <img src={src} alt={alt} className="max-w-full rounded-lg" /> : <span>{alt}</span>
  const url = got?.src === src ? got.url : null
  return url ? <img src={url} alt={alt} className="max-w-full rounded-lg" /> : <span className="text-muted">{alt || 'Picture'}</span>
}

export function MarkdownView({ source, className = '' }: { source: string; className?: string }) {
  return (
    <div className={`prose-note ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} urlTransform={urlTransform}
        components={{ img: ({ src, alt }) => <NotePicture src={typeof src === 'string' ? src : ''} alt={alt ?? ''} /> }}>{source}</ReactMarkdown>
    </div>
  )
}
