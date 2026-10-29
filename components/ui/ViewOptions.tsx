'use client'
import { Grid3x3, LayoutGrid, List } from 'lucide-react'
import { VIEW_CHOICES, useView, viewStore, type Layout, type ViewPage } from '@/lib/ui/listView'

const LAYOUTS: { value: Layout; label: string; Icon: typeof List }[] = [
  { value: 'grid', label: 'Grid', Icon: LayoutGrid }, { value: 'list', label: 'List', Icon: List }, { value: 'icons', label: 'Icons', Icon: Grid3x3 },
]

// How a list page shows its items: grid, list or icons, and in what order. The choice is kept on this device for that page.
export function ViewOptions({ page, className = '', sort = true }: { page: ViewPage; className?: string; sort?: boolean }) {
  const view = useView(page)
  const set = (patch: Partial<typeof view>) => viewStore(page).set({ ...view, ...patch })
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div role="radiogroup" aria-label="Layout" className="choice-track flex rounded-lg border border-line bg-raised p-0.5">
        {LAYOUTS.map(({ value, label, Icon }) => (
          <button key={value} type="button" role="radio" aria-checked={view.layout === value} title={label} aria-label={label}
            className={`choice grid size-8 place-items-center rounded-md transition pointer-coarse:size-10 ${view.layout === value ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'}`}
            onClick={() => set({ layout: value })}><Icon size={15} aria-hidden /></button>
        ))}
      </div>
      {sort && <select className="input !w-auto !py-1.5 text-sm" aria-label="Sort by" value={view.sort} onChange={e => set({ sort: e.target.value })}>
        {VIEW_CHOICES[page].sorts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>}
    </div>
  )
}
