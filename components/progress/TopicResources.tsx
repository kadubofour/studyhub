'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronRight, PlayCircle, FileText, X } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { postAi } from '@/components/ai/aiFetch'
import { supabase } from '@/lib/supabase/client'
import { MAX_SAVED, listResources, removeResource, saveResources, type Resource } from '@/lib/data/resources'
import { identityOf } from '@/lib/resources/clean'
import { Working } from '@/components/ui/Working'

type Found = { url: string; title: string; kind: 'video' | 'article'; channel?: string; seconds?: number }
const isWeb = (url: string) => /^https?:\/\//i.test(url)
const siteOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
const plural = (n: number) => `${n} link${n === 1 ? '' : 's'}`
// These codes talk about a note; on a topic they get plainer words
const GENERIC = new Set(['refused', 'too_long'])

// One topic's saved videos and articles, with a button to find more. Opens on demand so a long topic list stays light.
export function TopicResources({ topicId, topicName }: { topicId: string; topicName: string }) {
  const panel = useId()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Resource[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  // Where keyboard focus goes after the list changes: the Remove button now at this place, or the toggle
  const refocus = useRef<{ remove: number } | 'toggle' | null>(null)

  useEffect(() => {
    const want = refocus.current
    if (!want) return
    refocus.current = null
    const buttons = root.current?.querySelectorAll<HTMLButtonElement>('[data-remove]') ?? []
    const target = want === 'toggle' || buttons.length === 0 ? root.current?.querySelector<HTMLButtonElement>('[data-toggle]') : buttons[Math.min(want.remove, buttons.length - 1)]
    target?.focus()
  }, [items])

  async function load() {
    setLoadFailed(false); setProblem(null)
    try { setItems(await listResources(supabase(), topicId)) } catch { setLoadFailed(true) }
  }
  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && items === null) await load()
  }

  async function find() {
    if (!items) return
    setBusy(true); setProblem(null); setSaid('')
    const r = await postAi<{ resources: Found[] }>('/api/ai/resources', { topicId })
    if (!r.ok) {
      setBusy(false)
      setProblem({ code: r.error, message: r.error === 'empty' ? 'No usable links came back. Try again.' : GENERIC.has(r.error) ? 'The AI could not search for this topic. Try again.' : r.message })
      return
    }
    const have = new Set(items.map(i => identityOf(i.url)))
    const fresh = r.value.resources.filter(f => !have.has(identityOf(f.url))).slice(0, MAX_SAVED - items.length)
    if (!fresh.length) { setSaid('No new links this time.'); setBusy(false); return }
    try { await saveResources(supabase(), topicId, fresh) } catch { setProblem({ code: 'save', message: 'Could not save the links. Try again.' }); setBusy(false); return }
    try {
      const list = await listResources(supabase(), topicId)
      if (list.length >= MAX_SAVED) refocus.current = 'toggle'
      setItems(list); setSaid(`Added ${plural(fresh.length)}.`)
    } catch { setSaid(`Added ${plural(fresh.length)}. Reopen this list to see them.`) }
    setBusy(false)
  }

  async function remove(item: Resource, index: number) {
    try {
      await removeResource(supabase(), item.id)
      refocus.current = { remove: index }
      setItems(list => (list ?? []).filter(i => i.id !== item.id)); setSaid('Link removed.')
    } catch { setProblem({ code: 'remove', message: 'Could not remove that link.' }) }
  }

  const full = (items?.length ?? 0) >= MAX_SAVED
  return (
    <div ref={root} className="basis-full">
      <button type="button" data-toggle className="inline-flex items-center gap-1 text-xs font-medium text-accent" aria-expanded={open} aria-controls={panel}
        aria-label={`Resources for ${topicName}`} onClick={() => { void toggle() }}>
        <ChevronRight size={13} className={open ? 'rotate-90' : ''} aria-hidden />Resources
      </button>
      <div id={panel} hidden={!open}>
        {open && loadFailed && (
          <div className="mt-2 space-y-1">
            <AiError code="load" message="Could not load your links. Try again." />
            <button type="button" className="btn" onClick={() => { void load() }}>Try again</button>
          </div>
        )}
        {open && items && (
          <div className="mt-2 space-y-2">
            {items.length === 0 ? <p className="text-sm text-muted">No links yet.</p> : (
              <ul className="space-y-1.5">
                {items.map((i, n) => (
                  <li key={i.id} className="flex items-start gap-2 text-sm">
                    {i.kind === 'video' ? <PlayCircle size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden /> : <FileText size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      {isWeb(i.url) ? <a href={i.url} target="_blank" rel="noopener noreferrer" className="break-words text-accent underline-offset-2 hover:underline">{i.title}</a> : <span className="break-words">{i.title}</span>}
                      <span className="block text-xs text-muted"><span className="font-medium">{i.kind === 'video' ? 'Video' : 'Article'}</span> · <span>{siteOf(i.url)}</span>{i.channel && <> · <span>{i.channel}</span></>}{i.duration_seconds ? <> · <span>{Math.max(1, Math.round(i.duration_seconds / 60))} min</span></> : null}</span>
                    </span>
                    <button type="button" data-remove className="btn-ghost px-1" aria-label={`Remove ${i.title}`} onClick={() => { void remove(i, n) }}><X size={14} aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
            {full ? <p className="text-xs text-muted">This topic is full. Remove a link to find more.</p> : (
              <div className="flex flex-wrap items-center gap-2">
                {busy
                  ? <Working kind="search" size="sm" label="Searching the web" className="text-sm text-muted" />
                  : <button type="button" className="btn" onClick={() => { void find() }}>{items.length ? 'Find more' : 'Find resources'}</button>}
                <span className="text-xs text-muted">Uses 1 AI action</span>
              </div>
            )}
          </div>
        )}
        <p role="status" className="mt-1 text-xs text-muted">{open ? said : ''}</p>
        {open && problem && <div className="mt-1"><AiError code={problem.code} message={problem.message} /></div>}
      </div>
    </div>
  )
}
