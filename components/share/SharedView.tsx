'use client'
import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { ArrowLeft, ChevronRight, Copy, FileText, GraduationCap, Link2Off } from 'lucide-react'
import { Avatar } from '@/components/profile/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { InkLayer } from '@/components/notes/InkLayer'
import { ProgressCard } from '@/components/share/ProgressCard'
import { NoteImagesContext } from '@/components/notes/NoteImagesContext'
import { useToast } from '@/components/providers/ToastProvider'
import { sanitizeInk } from '@/lib/markup/ink'
import { isImageToken, tokenFile } from '@/lib/notes/images'
import { appearanceVars, effectiveLook } from '@/lib/appearance'

// What shared_item(token) returns for a live link
export type SharedOwner = { display_name: string; avatar_color: string | null; look: string | null; accent: string | null }
export type SharedNote = { id?: string; title: string; content_md: string; ink?: unknown }
export type SharedProgress = { level: number; total_xp: number; week_xp: number; streak: number; week_focus_minutes: number; display_name: string; avatar_color: string }
export type Shared =
  | { kind: 'deck'; owner: SharedOwner; item: { name: string; cards: { front: string; back: string }[] } }
  | { kind: 'note'; owner: SharedOwner; item: SharedNote }
  | { kind: 'notebook'; owner: SharedOwner; item: { name: string; notes: (SharedNote & { id: string })[] } }
  | { kind: 'progress'; owner: SharedOwner; item: SharedProgress }

const DEFAULT_AVATAR = '#3B5BDB'
const noopSubscribe = () => () => {}
const OPEN: Record<string, string> = { deck: '/flashcards/', note: '/notes/', notebook: '/notebooks/' }

// The studyhub mark, back to the front door
function Mark() {
  return (
    <Link href="/" className="flex items-center gap-2 text-fg">
      <span className="grid size-8 place-items-center rounded-lg bg-accent-solid text-white"><GraduationCap size={16} aria-hidden /></span>
      <span className="font-display font-semibold tracking-tight">Studyhub</span>
    </Link>
  )
}

function TurnedOff() {
  return (
    <div className="app-root min-h-dvh text-fg" style={appearanceVars('blue') as React.CSSProperties}>
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
        <Mark />
        <EmptyState icon={Link2Off} tone="a" level={1} title="This link was turned off"
          body="Whoever shared it has stopped sharing it, or swapped it for a new link. Ask them for the latest one.">
          <Link href="/" className="btn">Go to Studyhub</Link>
        </EmptyState>
      </main>
    </div>
  )
}

function NoteBody({ note }: { note: SharedNote }) {
  const marks = useMemo(() => sanitizeInk(note.ink), [note.ink])
  return (
    <article className="card relative overflow-hidden p-4 sm:p-6">
      <div className="relative">
        <MarkdownView source={note.content_md} />
        <InkLayer marks={marks} active={false} />
      </div>
    </article>
  )
}

function Deck({ cards }: { cards: { front: string; back: string }[] }) {
  if (!cards.length) return <p className="text-sm text-muted">This deck has no cards yet.</p>
  return (
    <ol aria-label="Cards" className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => (
        <li key={i} className="card flex min-w-0 flex-col gap-2 p-4">
          <p className="break-words font-medium">{c.front}</p>
          <p className="break-words border-t border-line pt-2 text-sm text-muted">{c.back}</p>
        </li>
      ))}
    </ol>
  )
}

function Notebook({ name, notes }: { name: string; notes: (SharedNote & { id: string })[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const note = notes.find(n => n.id === open)
  if (note) {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" className="btn self-start" onClick={() => setOpen(null)}><ArrowLeft size={15} aria-hidden />Back to {name}</button>
        <h2 className="font-display text-2xl font-semibold break-words">{note.title || 'Untitled'}</h2>
        <NoteBody note={note} />
      </div>
    )
  }
  if (!notes.length) return <p className="text-sm text-muted">This notebook has no notes yet.</p>
  return (
    <ul aria-label="Notes" className="card divide-y divide-line overflow-hidden p-0">
      {notes.map(n => (
        <li key={n.id}>
          <button type="button" onClick={() => setOpen(n.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface">
            <FileText size={16} aria-hidden className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate font-medium">{n.title || 'Untitled'}</span>
            <ChevronRight size={16} aria-hidden className="shrink-0 text-muted" />
          </button>
        </li>
      ))}
    </ul>
  )
}

// The same card the student shared, drawn in their look
function Progress({ p }: { p: SharedProgress }) {
  return (
    <section aria-label="Progress" className="flex justify-center">
      <ProgressCard snapshot={p} className="block h-auto w-full max-w-md rounded-2xl border border-line" />
    </section>
  )
}

/**
 * What a share link shows, to anyone who has it: the item, in its owner's look and colour, with who shared it, and a way to
 * copy it into the visitor's own Studyhub. Signed out, copying goes through log in (or sign up) and comes back here with
 * ?copy=1; the visitor still presses Copy themselves. `shared` is null for a link that was turned off.
 */
export function SharedView({ token, shared, signedIn, askedToCopy }: { token: string; shared: Shared | null; signedIn: boolean; askedToCopy: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const { resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const [off, setOff] = useState(false)
  const [copying, setCopying] = useState(false)
  // Pictures are drawn through this link, never from the visitor's own folder
  const images = useMemo(() => ({
    resolve: async (src: string) => {
      if (!isImageToken(src)) return src
      const file = tokenFile(src)
      return file ? `/s/${encodeURIComponent(token)}/image/${file}` : null
    },
  }), [token])

  if (!shared || off) return <TurnedOff />

  const look = effectiveLook(shared.owner.look, mounted ? resolvedTheme : undefined)
  const title = shared.kind === 'deck' || shared.kind === 'notebook' ? shared.item.name
    : shared.kind === 'note' ? shared.item.title || 'Untitled' : `${shared.owner.display_name}'s progress`
  const copyable = shared.kind !== 'progress'
  const back = `/s/${token}?copy=1`

  async function copy() {
    setCopying(true)
    try {
      const res = await fetch(`/api/share/${encodeURIComponent(token)}/copy`, { method: 'POST' })
      const body = await res.json().catch(() => null) as { kind?: string; id?: string; error?: string } | null
      if (res.ok && body?.kind && body.id && OPEN[body.kind]) { router.push(`${OPEN[body.kind]}${body.id}`); return }
      if (res.status === 410) { setOff(true); return }
      if (res.status === 401) { router.push(`/login?next=${encodeURIComponent(back)}`); return }
      toast(res.status === 429 ? 'You have copied a lot just now. Try again in a little while.' : 'Couldn\'t copy this. Try again.')
    } catch {
      toast('Couldn\'t copy this. Check your connection and try again.')
    }
    setCopying(false)
  }

  const copyButton = !copyable ? null : signedIn
    ? <button type="button" className="btn-primary" onClick={copy} disabled={copying}><Copy size={15} aria-hidden />{copying ? 'Copying…' : 'Copy to my Studyhub'}</button>
    : <Link href={`/login?next=${encodeURIComponent(back)}`} className="btn-primary"><Copy size={15} aria-hidden />Copy to my Studyhub</Link>

  return (
    <div className="app-root min-h-dvh text-fg" data-look={look} style={appearanceVars(shared.owner.accent) as React.CSSProperties}>
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <Mark />
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">Shared by</span>
            <Avatar name={shared.owner.display_name} color={shared.owner.avatar_color || DEFAULT_AVATAR} size={28} />
            <span className="truncate font-medium">{shared.owner.display_name}</span>
          </p>
        </div>

        {copyable && signedIn && askedToCopy && (
          <p role="note" className="rounded-xl bg-accent-soft px-4 py-3 text-sm">You&apos;re signed in. Copy this into your Studyhub to keep it and change it as you like.</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted">{shared.kind === 'deck' ? `Deck · ${shared.item.cards.length} ${shared.item.cards.length === 1 ? 'card' : 'cards'}`
              : shared.kind === 'notebook' ? `Notebook · ${shared.item.notes.length} ${shared.item.notes.length === 1 ? 'note' : 'notes'}`
              : shared.kind === 'note' ? 'Note' : 'Progress'}</p>
            <h1 className="font-display text-3xl font-semibold break-words">{title}</h1>
          </div>
          {copyButton && <div className="shrink-0">{copyButton}</div>}
        </div>

        <NoteImagesContext.Provider value={images}>
          {shared.kind === 'deck' && <Deck cards={shared.item.cards} />}
          {shared.kind === 'note' && <NoteBody note={shared.item} />}
          {shared.kind === 'notebook' && <Notebook name={shared.item.name} notes={shared.item.notes} />}
          {shared.kind === 'progress' && <Progress p={shared.item} />}
        </NoteImagesContext.Provider>
      </main>
    </div>
  )
}
