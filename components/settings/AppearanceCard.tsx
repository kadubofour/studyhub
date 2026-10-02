'use client'
import { Check } from 'lucide-react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { ACCENTS, FONTS, type AccentName, type FontName } from '@/lib/appearance'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'

const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[]
const FONT_NAMES = Object.keys(FONTS) as FontName[]

// Accent and font apply instantly (the whole app re-colours / re-fonts) and save in the background
export function AppearanceCard() {
  const { profile, setProfile } = useProfile()
  const save = useSaver()

  function choose(patch: { accent?: AccentName; font?: FontName }) {
    const before = profile
    save(
      () => setProfile(p => ({ ...p, ...patch })),
      // Roll back only the appearance fields, not changes saved elsewhere meanwhile
      () => setProfile(p => ({ ...p, accent: before.accent, font: before.font })),
      () => updateProfile(supabase(), profile.id, patch),
    )
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-base font-semibold">Appearance</h2>
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
