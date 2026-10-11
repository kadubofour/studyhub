'use client'
import { useState } from 'react'
import { ChevronRight, PlayCircle, FileText, X } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { postAi } from '@/components/ai/aiFetch'
import { supabase } from '@/lib/supabase/client'
import { MAX_SAVED, listResources, removeResource, saveResources, type Resource } from '@/lib/data/resources'

type Found = { url: string; title: string; kind: 'video' | 'article' }
const isWeb = (url: string) => /^https?:\/\//i.test(url)
const siteOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

// One topic's saved videos and articles, with a button to find more. Opens on demand so a long topic list stays light.
export function TopicResources({ topicId, topicName }: { topicId: string; topicName: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Resource[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && items === null) {
      setProblem(null)
      try { setItems(await listResources(supabase(), topicId)) } catch { setItems([]); setProblem({ code: 'load', message: 'Could not load your links. Try again.' }) }
    }
  }

  async function find() {
    if (!items) return
    setBusy(true); setProblem(null)
    const r = await postAi<{ resources: Found[] }>('/api/ai/resources', { topicId })
    if (!r.ok) {
      setBusy(false)
      setProblem({ code: r.error, message: r.error === 'empty' ? 'No usable links came back. Try again.' : r.message })
      return
    }
    const have = new Set(items.map(i => i.url))
    const fresh = r.value.resources.filter(f => !have.has(f.url)).slice(0, MAX_SAVED - items.length)
    try {
      await saveResources(supabase(), topicId, fresh)
      setItems(await listResources(supabase(), topicId))
    } catch { setProblem({ code: 'save', message: 'Could not save the links. Try again.' }) }
    setBusy(false)
  }

  async function remove(item: Resource) {
    try { await removeResource(supabase(), item.id); setItems(list => (list ?? []).filter(i => i.id !== item.id)) } catch { setProblem({ code: 'remove', message: 'Could not remove that link.' }) }
  }

  const full = (items?.length ?? 0) >= MAX_SAVED
  return (
    <div className="basis-full">
      <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-accent" aria-expanded={open} aria-label={`Resources for ${topicName}`} onClick={() => { void toggle() }}>
        <ChevronRight size={13} className={open ? 'rotate-90' : ''} aria-hidden />Resources
      </button>
      {open && items && (
        <div className="mt-2 space-y-2">
          {items.length === 0 ? <p className="text-sm text-muted">No links yet.</p> : (
            <ul className="space-y-1.5">
              {items.map(i => (
                <li key={i.id} className="flex items-start gap-2 text-sm">
                  {i.kind === 'video' ? <PlayCircle size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden /> : <FileText size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    {isWeb(i.url) ? <a href={i.url} target="_blank" rel="noopener noreferrer" className="break-words text-accent underline-offset-2 hover:underline">{i.title}</a> : <span className="break-words">{i.title}</span>}
                    <span className="block text-xs text-muted"><span className="font-medium">{i.kind === 'video' ? 'Video' : 'Article'}</span> · <span>{siteOf(i.url)}</span></span>
                  </span>
                  <button type="button" className="btn-ghost px-1" aria-label={`Remove ${i.title}`} onClick={() => { void remove(i) }}><X size={14} aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          {full ? <p className="text-xs text-muted">This topic is full. Remove a link to find more.</p> : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn" disabled={busy} onClick={() => { void find() }}>{busy ? 'Searching…' : items.length ? 'Find more' : 'Find resources'}</button>
              <span className="text-xs text-muted">Uses 1 AI action</span>
            </div>
          )}
        </div>
      )}
      {problem && <div className="mt-1"><AiError code={problem.code} message={problem.message} /></div>}
    </div>
  )
}
