'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Copy, FolderOpen, PencilLine } from 'lucide-react'
import { MarkdownView, PictureOwnerContext } from '@/components/notes/MarkdownView'
import { EmptyState } from '@/components/ui/EmptyState'
import { PAGE_TITLE } from '@/components/ui/PageHeader'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { sharedDeck, sharedNote, sharedWithMe, type SharedDeck, type SharedNote, type SharedWithMe } from '@/lib/data/friends'
import { copySharedDeck, copySharedNote } from '@/lib/friends/copy'

type Loaded = { share: SharedWithMe } & ({ kind: 'note'; note: SharedNote } | { kind: 'deck'; deck: SharedDeck })

// A note or deck a friend shared: to read, and to save as your own copy. It cannot be changed here.
export default function SharedItemPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const { profile } = useProfile()
  const [item, setItem] = useState<Loaded | null | 'gone'>(null)
  const [failed, setFailed] = useState(false)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    let live = true
    const sb = supabase()
    ;(async () => {
      const share = (await sharedWithMe(sb)).find(s => s.id === id)
      if (!share) return 'gone' as const
      if (share.kind === 'note') { const note = await sharedNote(sb, id); return note ? { share, kind: 'note' as const, note } : 'gone' as const }
      const deck = await sharedDeck(sb, id)
      return deck ? { share, kind: 'deck' as const, deck } : 'gone' as const
    })().then(r => { if (live) setItem(r) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [id])

  async function saveCopy() {
    if (!item || item === 'gone' || copying) return
    setCopying(true)
    try {
      const sb = supabase()
      if (item.kind === 'note') { const made = await copySharedNote(sb, profile.id, item.note); toast('Saved to your notes.'); router.push(`/notes/${made}`) }
      else { const made = await copySharedDeck(sb, item.deck); toast('Saved to your flashcards.'); router.push(`/flashcards/${made}`) }
    } catch { toast('Couldn\'t save a copy. Try again.') } finally { setCopying(false) }
  }

  const back = <Link href="/friends" className="btn-ghost -ml-2.5 mb-3"><ArrowLeft size={16} aria-hidden />Friends</Link>
  if (failed) return <div>{back}<p role="alert" className="card text-sm text-danger">Couldn&apos;t open this. Check your connection.</p></div>
  if (item === null) return <div>{back}<p className="text-sm text-muted">Loading…</p></div>
  if (item === 'gone') return (
    <div>{back}
      <EmptyState icon={FolderOpen} tone="b" title="No longer shared" body="Your friend stopped sharing this, deleted it, or you are no longer friends. Copies you saved are still yours." />
    </div>
  )

  const title = item.kind === 'note' ? item.note.title : item.deck.name
  return (
    <div className="mx-auto max-w-3xl">
      {back}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE}>{title || 'Untitled'}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {item.kind === 'note' ? 'A note' : `A deck of ${item.deck.cards.length} card${item.deck.cards.length === 1 ? '' : 's'}`} shared by {item.share.owner_name}
          </p>
        </div>
        <button type="button" className="btn-primary" disabled={copying} onClick={() => { void saveCopy() }}><Copy size={14} aria-hidden />{copying ? 'Saving…' : 'Save a copy'}</button>
      </div>
      {item.kind === 'note' ? (
        <article className="card">
          {Array.isArray(item.note.ink) && item.note.ink.length > 0 && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm text-muted"><PencilLine size={15} aria-hidden />This note has a drawing on it. Save a copy to see it.</p>
          )}
          <PictureOwnerContext.Provider value={item.note.owner_id}>
            <MarkdownView source={item.note.content_md || '*This note is empty.*'} />
          </PictureOwnerContext.Provider>
        </article>
      ) : (
        <ol aria-label="Cards" className="grid gap-3 sm:grid-cols-2">
          {item.deck.cards.map((c, i) => (
            <li key={i} className="tile !p-0">
              <div className="border-b border-line px-4 py-3"><span className="block text-xs font-medium text-muted">Front</span><MarkdownView source={c.front} /></div>
              <div className="px-4 py-3"><span className="block text-xs font-medium text-muted">Back</span><MarkdownView source={c.back} /></div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
