import { ACCENTS } from '@/lib/appearance'

const COVERS = Object.values(ACCENTS).map(a => a.solid)
const plural = (n: number) => `${n} note${n === 1 ? '' : 's'}`

/** Each notebook keeps one cover colour, picked from its id, so it is the same notebook wherever it shows */
export function coverColor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COVERS[h % COVERS.length]
}

/**
 * A notebook drawn as a notebook: a coloured cover, a darker spine with its rings, a label with the name, and how many notes are inside.
 * `kind` draws the two that are not notebooks: All notes (a grey cover) and Unfiled (loose pages, with no cover).
 */
export function NotebookCover({ name, count, color, kind = 'notebook', on = false }: {
  name: string; count: number; color?: string; kind?: 'notebook' | 'all' | 'loose'; on?: boolean
}) {
  const ring = on ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''
  if (kind === 'loose') return (
    <span data-notebook-cover aria-hidden className={`relative flex aspect-[4/5] w-full flex-col justify-end rounded-lg border-2 border-dashed border-line bg-raised p-2.5 text-left transition ${ring}`}>
      <span className="absolute inset-x-3 top-3 space-y-1.5">{[0, 1, 2].map(i => <span key={i} className="block h-px bg-line" />)}</span>
      <span className="line-clamp-2 text-[13px] font-semibold leading-tight">{name}</span>
      <span className="text-[11px] text-muted">{plural(count)}</span>
    </span>
  )
  const cover = kind === 'all' ? '#5A5E80' : (color ?? 'var(--accent-solid)')
  return (
    <span data-notebook-cover aria-hidden className={`relative flex aspect-[4/5] w-full overflow-hidden rounded-l-md rounded-r-xl shadow-[var(--shadow)] transition ${ring}`} style={{ background: cover }}>
      {/* the spine and its rings */}
      <span className="flex w-3.5 shrink-0 flex-col items-center justify-evenly py-2" style={{ background: 'color-mix(in srgb, #000 28%, transparent)' }}>
        {[0, 1, 2, 3, 4].map(i => <span key={i} className="size-1.5 rounded-full bg-black/45 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]" />)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-between p-2.5 pl-2">
        {/* the label on the cover */}
        <span className="rounded-md bg-white/92 px-1.5 py-1.5 text-[12.5px] font-semibold leading-tight text-[#151628] shadow-sm [overflow-wrap:anywhere]">
          <span className="line-clamp-2">{name}</span>
        </span>
        <span className="text-[11px] font-semibold text-white">{plural(count)}</span>
      </span>
      {/* the page edges showing at the side */}
      <span className="w-1 shrink-0 bg-white/30" />
    </span>
  )
}
