'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, FileText, MoreVertical, Pencil, Plus, Search, Trash2, UploadCloud } from 'lucide-react'
import { Dropdown } from '@/components/ui/Dropdown'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { NotebookCover } from '@/components/notes/NotebookCover'
import { useScreen } from '@/lib/ui/useScreen'
import { contents, type NotebookCard, type NotebookSort } from '@/lib/library/notebookCards'
import type { LibraryItem } from '@/lib/library/items'

const SORTS = [
  { value: 'recent', label: 'Last accessed' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Most in them' },
] as const

const BAR = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-medium transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

// The Library's landing: a shelf of notebooks, each drawn as a notebook (a notebook is a study set: everything for one subject, in one place).
// Materials adds raw study material (a PDF, slides, a document) to a notebook.
export function LibraryOverview({ cards, found, bookName, q, onQ, sort, onSort, onMaterials, create, onRename, onDelete }: {
  cards: NotebookCard[]; q: string; onQ: (q: string) => void; sort: NotebookSort; onSort: (s: NotebookSort) => void
  /** What a search finds inside the notebooks, and the name of the notebook an item is in */
  found: LibraryItem[]; bookName: (id: string | null | undefined) => string
  onMaterials: () => void
  /** What the Create button offers (a new note, a recording, a notebook…) */
  create: MenuEntry[]
  onRename: (c: NotebookCard) => void; onDelete: (c: NotebookCard) => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const phone = useScreen() === 'phone'
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

      {cards.length > 0 && (
      <ul aria-label="Notebooks" className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-5 gap-y-6">
        {cards.map(c => <Book key={c.notebook.id} card={c} onRename={onRename} onDelete={onDelete} />)}
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

// A notebook on the shelf: the cover is the link, and pressing and holding it (a right click) opens the same menu as its ⋮ button
function Book({ card, onRename, onDelete }: { card: NotebookCard; onRename: (c: NotebookCard) => void; onDelete: (c: NotebookCard) => void }) {
  const router = useRouter()
  const { notebook, color } = card
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const href = `/notebooks/${notebook.id}`
  const items: MenuEntry[] = [
    { label: 'Open', icon: ArrowUpRight, onSelect: () => router.push(href) },
    { label: 'Rename', icon: Pencil, onSelect: () => onRename(card) },
    ...(notebook.is_default ? [] : [{ label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(card) } as MenuEntry]),
  ]
  return (
    <li className="relative">
      <Link href={href} aria-label={notebook.name} title={notebook.name} onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
        className="block rounded-l-md rounded-r-xl outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
        <NotebookCover name={notebook.name} count={card.total} detail={contents(card)} color={color} />
      </Link>
      <span className="sr-only">{contents(card)}</span>
      <button type="button" aria-label={`Options for ${notebook.name}`} aria-haspopup="menu" className="absolute bottom-1 right-1.5 grid size-9 place-items-center rounded-full text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right, y: r.bottom + 4 }) }}><MoreVertical size={18} aria-hidden /></button>
      {menu && <ContextMenu x={menu.x} y={menu.y} label={`${notebook.name} options`} onClose={() => setMenu(null)} items={items} />}
    </li>
  )
}
