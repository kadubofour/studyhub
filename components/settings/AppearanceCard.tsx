'use client'
import { useSyncExternalStore } from 'react'
import { Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { ACCENTS, FONTS, LOOKS, lookOf, type AccentName, type FontName, type LookName } from '@/lib/appearance'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'

const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[]
const FONT_NAMES = Object.keys(FONTS) as FontName[]
const LOOK_NAMES = Object.keys(LOOKS) as LookName[]
const noopSubscribe = () => () => {}

// Accent and font apply instantly (the whole app re-colours / re-fonts) and save in the background
export function AppearanceCard() {
  const { profile, setProfile } = useProfile()
  const save = useSaver()
  const { resolvedTheme } = useTheme()
  // The server can't know the theme: draw the previews light until the page has hydrated, so both agree
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const mode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light'
  const look = lookOf(profile.look)

  function choose(patch: { accent?: AccentName; font?: FontName; look?: LookName }) {
    const before = profile
    const keys = Object.keys(patch) as (keyof typeof patch)[]
    save(
      () => setProfile(p => ({ ...p, ...patch })),
      // Roll back only the field that failed, not another appearance choice saved meanwhile
      () => setProfile(p => ({ ...p, ...(Object.fromEntries(keys.map(k => [k, before[k]])) as typeof patch) })),
      () => updateProfile(supabase(), profile.id, patch),
    )
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-base font-semibold">Appearance</h2>
      <div>
        <div className="mb-2 text-sm text-muted">Look</div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Look">
          {LOOK_NAMES.map((name, i) => {
            const on = look === name
            const c = LOOKS[name][mode]
            return (
              <button key={name} type="button" role="radio" aria-checked={on} aria-label={`${LOOKS[name].label} look`}
                tabIndex={on ? 0 : -1}
                onKeyDown={e => {
                  const to = radioKeyTarget(e.key, i, LOOK_NAMES.length)
                  if (to === null) return
                  e.preventDefault(); choose({ look: LOOK_NAMES[to] }); focusRadio(e.currentTarget, to)
                }}
                onClick={() => choose({ look: name })}
                className={`rounded-xl border p-2 text-left transition ${on ? 'border-accent ring-2 ring-accent-soft' : 'border-line hover:bg-surface'}`}>
                <div className="flex h-14 items-end gap-1.5 rounded-lg p-2" style={{ background: c.bg, border: `1px solid ${c.line}` }} aria-hidden>
                  <div className="h-8 flex-1 rounded-md" style={{ background: c.tiles[0], border: `1px solid ${c.line}` }} />
                  <div className="h-8 flex-1 rounded-md" style={{ background: c.tiles[1], border: `1px solid ${c.line}` }} />
                  <div className="h-5 w-8 rounded-md" style={{ background: ACCENTS[profile.accent]?.solid ?? ACCENTS.blue.solid }} />
                </div>
                <div className="mt-1.5 text-sm font-medium">{LOOKS[name].label}</div>
                <div className="text-xs text-muted">{LOOKS[name].blurb}</div>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm text-muted">Accent colour</div>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Accent colour">
          {ACCENT_NAMES.map((name, i) => {
            const a = ACCENTS[name]
            const on = profile.accent === name
            return (
              <button key={name} type="button" role="radio" aria-checked={on} aria-label={`${a.label} accent`} title={a.label}
                tabIndex={on ? 0 : -1}
                onKeyDown={e => {
                  const to = radioKeyTarget(e.key, i, ACCENT_NAMES.length)
                  if (to === null) return
                  e.preventDefault(); choose({ accent: ACCENT_NAMES[to] }); focusRadio(e.currentTarget, to)
                }}
                onClick={() => choose({ accent: name })}
                className={`flex size-9 items-center justify-center rounded-full text-white transition ${on ? 'ring-2 ring-fg ring-offset-2 ring-offset-raised' : 'hover:scale-105'}`}
                style={{ background: `linear-gradient(135deg, ${a.solid}, ${a.glow})` }}>
                {on && <Check size={16} aria-hidden />}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm text-muted">Font</div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Font">
          {FONT_NAMES.map((name, i) => {
            const on = profile.font === name
            return (
              <button key={name} type="button" role="radio" aria-checked={on} onClick={() => choose({ font: name })}
                tabIndex={on ? 0 : -1}
                onKeyDown={e => {
                  const to = radioKeyTarget(e.key, i, FONT_NAMES.length)
                  if (to === null) return
                  e.preventDefault(); choose({ font: FONT_NAMES[to] }); focusRadio(e.currentTarget, to)
                }}
                className={`rounded-xl border px-3 py-2 text-left transition ${on ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface'}`}
                style={{ fontFamily: `var(${FONTS[name].cssVar})` }}>
                <div className="text-sm font-medium">{FONTS[name].label}</div>
                <div className="text-xs text-muted">The quick brown fox, x² + y² = r²</div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
