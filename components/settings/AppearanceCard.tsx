'use client'
import { Check } from 'lucide-react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { ACCENTS, CONTENT_WIDTHS, FONTS, contentWidthOf, type AccentName, type ContentWidth, type FontName } from '@/lib/appearance'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { SettingRow } from './SettingRow'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'

const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[]
const FONT_NAMES = Object.keys(FONTS) as FontName[]

// Accent and font apply instantly (the whole app re-colours / re-fonts) and save in the background
export function AppearanceCard() {
  const { profile, setProfile } = useProfile()
  const save = useSaver()

  function choose(patch: { accent?: AccentName; font?: FontName; content_width?: ContentWidth }) {
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
    <div className="card divide-y divide-line p-0">
      <SettingRow title="Content width" hint="Focused is a centred column, Wide uses more of the screen, Full uses all of it.">
        <ChoiceChips label="Content width" value={contentWidthOf(profile.content_width)} options={CONTENT_WIDTHS.map(w => ({ value: w.id, label: w.label }))} onChange={v => choose({ content_width: v as ContentWidth })} />
      </SettingRow>
      <SettingRow title="Accent colour" hint="Buttons, links and highlights.">
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
      </SettingRow>
      <SettingRow title="Font" hint="The typeface used throughout.">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Font">
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
      </SettingRow>
    </div>
  )
}
