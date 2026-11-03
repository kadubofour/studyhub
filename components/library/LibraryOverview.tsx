'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, FileText, MoreVertical, Pencil, Plus, Search, Trash2, UploadCloud } from 'lucide-react'
import { Dropdown } from '@/components/ui/Dropdown'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { NotebookCover } from '@/components/notes/NotebookCover'
import { NotebookMark, PhoneGroup, PhoneRow } from '@/components/ui/PhoneList'
import { useScreen } from '@/lib/ui/useScreen'
import { ago } from '@/lib/library/ago'
import { CARD_KINDS, contents, type NotebookCard, type NotebookSort } from '@/lib/library/notebookCards'
import type { LibraryItem } from '@/lib/library/items'

const SORTS = [
  { value: 'recent', label: 'Last accessed' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Most in them' },
] as const

const BAR = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-medium transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

// The Library's landing: a card for each notebook (a notebook is a study set: everything for one subject, in one place).
// Materials adds raw study material (a PDF, slides, a document) to a notebook.
export function LibraryOverview({ cards, found, bookName, now, q, onQ, sort, onSort, onMaterials, create, onRename, onDelete }: {
  cards: NotebookCard[]; now: Date; q: string; onQ: (q: string) => void; sort: NotebookSort; onSort: (s: NotebookSort) => void
  /** What a search finds inside the notebooks, and the name of the notebook an item is in */
  found: LibraryItem[]; bookName: (id: string | null | undefined) => string
  onMaterials: () => void
  /** What the Create button offers (a new note, a recording, a notebook…) */
  create: MenuEntry[]
  onRename: (c: NotebookCard) => void; onDelete: (c: NotebookCard) => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const router = useRouter()
  const phone = useScreen() === 'phone'
  // on a phone a notebook is a row in a rounded group, as in the Tutor and Practice lists; pressing and holding it opens its menu
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; card: NotebookCard } | null>(null)
  return (
    <div>
      <div role="search" className="mb-5 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-[1_1_16rem]">
          <span className="sr-only">Search notebooks</span>
          <Search size={17} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={e => onQ(e.target.value)} placeholder="Search notebooks…" aria-label="Search notebooks"
            className="h-11 w-full rounded-xl border border-line bg-raised pl-10 pr-3 text-[15px] outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent" />
        </label>
        <Dropdown label="Sort notebooks" value={sort} onChange={s => onSort(s as NotebookSort)} options={SORTS.map(s => ({ value: s.value, label: s.label }))} className="w-44" />
        {phone ? (
          // a phone: only the icons, no borders or padding
          <>
            <button type="button" aria-label="Materials" title="Materials" className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg" onClick={onMaterials}><UploadCloud size={20} aria-hidden /></button>
            <button type="button" aria-label="Create" title="Create" aria-haspopup="menu" className="grid size-10 place-items-center rounded-full bg-fg text-bg"
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 200, y: r.bottom + 6 }) }}><Plus size={19} aria-hidden /></button>
          </>
        ) : (
          <>
            <button type="button" className={BAR} onClick={onMaterials}><UploadCloud size={16} aria-hidden />Materials</button>
            <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-fg px-4 text-sm font-semibold text-bg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              aria-haspopup="menu" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 200, y: r.bottom + 6 }) }}>
              <Plus size={16} aria-hidden />Create
            </button>
          </>
        )}
        {menu && <ContextMenu x={Math.max(8, menu.x)} y={menu.y} label="Create" items={create} onClose={() => setMenu(null)} />}
      </div>

      {phone ? (
        <>
          {cards.length > 0 && (
            <PhoneGroup name="Notebooks">
              {cards.map(c => (
                <PhoneRow key={c.notebook.id} href={`/notebooks/${c.notebook.id}`} mark={<NotebookMark color={c.color} />} title={c.notebook.name}
                  date={c.lastAt ? ago(c.lastAt, now) : undefined} line={contents(c)}
                  onContextMenu={e => { e.preventDefault(); setRowMenu({ x: e.clientX, y: e.clientY, card: c }) }} />
              ))}
            </PhoneGroup>
          )}
          {rowMenu && <ContextMenu x={rowMenu.x} y={rowMenu.y} label={`${rowMenu.card.notebook.name} options`} onClose={() => setRowMenu(null)} items={[
            { label: 'Open', icon: ArrowUpRight, onSelect: () => router.push(`/notebooks/${rowMenu.card.notebook.id}`) },
            { label: 'Rename', icon: Pencil, onSelect: () => onRename(rowMenu.card) },
            ...(rowMenu.card.notebook.is_default ? [] : [{ label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(rowMenu.card) } as MenuEntry]),
          ]} />}
        </>
      ) : cards.length > 0 && (
      <ul aria-label="Notebooks" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(c => <Card key={c.notebook.id} card={c} now={now} onRename={onRename} onDelete={onDelete} />)}
      </ul>
      )}
      {cards.length === 0 && !q.trim() && <p className="mt-6 text-center text-sm text-muted">No notebooks yet. Use Create to make one.</p>}
      {cards.length === 0 && q.trim() && found.length === 0 && <p className="mt-6 text-center text-sm text-muted">Nothing matches “{q.trim()}”.</p>}

      {q.trim() && found.length > 0 && (
        <section aria-label="Found in your notebooks" className="mt-8">
          <h2 className="section-label">Found in your notebooks</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
            {found.slice(0, 30).map(i => (
              <li key={`${i.kind}:${i.id}`}>
                <Link href={i.href} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface">
                  <span className="flex min-w-0 items-center gap-2"><FileText size={15} aria-hidden className="shrink-0 text-muted" /><span className="truncate font-medium">{i.title || 'Untitled'}</span></span>
                  <span className="shrink-0 text-xs text-muted">in {bookName(i.notebook_id)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Card({ card, now, onRename, onDelete }: { card: NotebookCard; now: Date; onRename: (c: NotebookCard) => void; onDelete: (c: NotebookCard) => void }) {
  const router = useRouter()
  const { notebook, lastAt, color } = card
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const href = `/notebooks/${notebook.id}`
  const items: MenuEntry[] = [
    { label: 'Open', icon: ArrowUpRight, onSelect: () => router.push(href) },
    { label: 'Rename', icon: Pencil, onSelect: () => onRename(card) },
    ...(notebook.is_default ? [] : [{ label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(card) } as MenuEntry]),
  ]
  return (
    <li className="group relative rounded-2xl border border-line bg-raised p-4 transition hover:shadow-md">
      <div className="flex items-start gap-4">
        <div aria-hidden className="w-14 shrink-0"><NotebookCover name={notebook.name} count={card.total} color={color} /></div>
        <div className="min-w-0 flex-1">
          {/* the whole card is the link; the ⋮ button sits above it */}
          <h3 className="truncate text-[17px] font-semibold"><Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">{notebook.name}</Link></h3>
          <p className="mt-1 text-sm text-muted">{contents(card)}</p>
          <p className="mt-3 flex flex-wrap gap-1.5">
            {CARD_KINDS.filter(k => card.counts[k.kind] > 0).map(k => (
              <span key={k.kind} className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{card.counts[k.kind]} {k.one}{card.counts[k.kind] === 1 ? '' : 's'}</span>
            ))}
          </p>
        </div>
        <button type="button" aria-label={`Options for ${notebook.name}`} aria-haspopup="menu" className="relative z-10 -mr-2 -mt-1 grid size-9 place-items-center rounded-full text-muted hover:bg-surface"
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right, y: r.bottom + 4 }) }}><MoreVertical size={18} aria-hidden /></button>
        {menu && <ContextMenu x={menu.x} y={menu.y} label={`${notebook.name} options`} onClose={() => setMenu(null)} items={items} />}
      </div>
      <p className="mt-4 flex items-center justify-between text-sm text-muted"><span>Last updated</span><span className="text-fg/80">{lastAt ? ago(lastAt, now) : 'Not yet'}</span></p>
    </li>
  )
}
