'use client'
import { Check } from 'lucide-react'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'
import type { ThemePref } from '@/lib/types'

const THEMES: { value: ThemePref; label: string }[] = [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]

// Each mode's own colours, fixed: a tile shows that mode whatever the page is in now
const PAINT = {
  light: { page: '#f6f5f1', panel: '#ffffff', line: '#d9d6cf', text: '#2b2a27', soft: '#e8e6e0' },
  dark: { page: '#1c1c1e', panel: '#2a2a2d', line: '#3a3a3d', text: '#e9e8e4', soft: '#3d3d40' },
} as const

// A little window of the app in one mode: a sidebar dot, a message line, two of the student's lines in the accent, a reply box
function Window({ mode }: { mode: 'light' | 'dark' }) {
  const p = PAINT[mode]
  return (
    <div className="flex h-full w-full gap-1.5 p-2" style={{ background: p.page }}>
      <span className="mt-0.5 size-2.5 shrink-0 rounded-full" style={{ background: p.line }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
        <span className="ml-auto h-1.5 w-3/5 rounded-full bg-[var(--accent-solid)]" />
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: p.soft }} />
        <span className="h-1.5 w-1/2 rounded-full" style={{ background: p.soft }} />
        <span className="ml-auto h-1.5 w-2/5 rounded-full bg-[var(--accent-solid)] opacity-70" />
        <span className="mt-auto flex h-3.5 items-center justify-end rounded-full border px-1" style={{ borderColor: p.line, background: p.panel }}>
          <span className="size-1.5 rounded-full bg-[var(--accent-solid)]" />
        </span>
      </div>
    </div>
  )
}

/** System, Light and Dark as three small pictures of the app, the chosen one ringed in the accent, as an OS's settings show them */
export function ThemeTiles({ value, onChange }: { value: ThemePref; onChange: (t: ThemePref) => void }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-3">
      {THEMES.map((t, i) => {
        const on = value === t.value
        return (
          <button key={t.value} type="button" role="radio" aria-checked={on} aria-label={t.label} tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={e => {
              const to = radioKeyTarget(e.key, i, THEMES.length)
              if (to === null) return
              e.preventDefault(); onChange(THEMES[to].value); focusRadio(e.currentTarget, to)
            }}
            className="group flex w-[6.75rem] flex-col items-center gap-1.5 text-sm">
            <span className={`relative block h-[4.25rem] w-full overflow-hidden rounded-xl border transition ${on ? 'border-transparent ring-2 ring-[var(--accent-solid)] ring-offset-2 ring-offset-raised' : 'border-line group-hover:border-[color-mix(in_srgb,var(--fg)_30%,var(--line))]'}`}>
              {t.value === 'system'
                ? <span className="absolute inset-0 flex"><span className="w-1/2 overflow-hidden"><span className="block h-full w-[6.75rem]"><Window mode="light" /></span></span>
                    <span className="w-1/2 overflow-hidden"><span className="-ml-[3.375rem] block h-full w-[6.75rem]"><Window mode="dark" /></span></span></span>
                : <Window mode={t.value} />}
            </span>
            <span className={`flex items-center gap-1 ${on ? 'font-medium text-fg' : 'text-muted'}`}>{t.label}{on && <Check size={13} className="text-[var(--accent-solid)]" aria-hidden />}</span>
          </button>
        )
      })}
    </div>
  )
}
