'use client'
import { useSyncExternalStore } from 'react'
import { Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { ACCENTS, CONTENT_WIDTHS, FONTS, LOOKS, contentWidthOf, effectiveLook, lookChoices, type AccentName, type ContentWidth, type FontName, type LookName } from '@/lib/appearance'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { SettingRow } from './SettingRow'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'

const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[]
const FONT_NAMES = Object.keys(FONTS) as FontName[]
const noopSubscribe = () => () => {}

// Accent and font apply instantly (the whole app re-colours / re-fonts) and save in the background
export function AppearanceCard() {
  const { profile, setProfile } = useProfile()
  const save = useSaver()
  const { resolvedTheme } = useTheme()
  // The server can't know the theme: draw the previews light until the page has hydrated, so both agree
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const mode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light'
  const look = effectiveLook(profile.look, mode) // Paper shows as Classic in dark mode
  const LOOK_NAMES = lookChoices(mode)

  function choose(patch: { accent?: AccentName; font?: FontName; look?: LookName; content_width?: ContentWidth }) {
    if (Object.keys(patch).length === 1 && patch.look === look) return // e.g. Classic shown for a saved Paper in dark mode: keep the saved choice
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
      <SettingRow title="Look" hint="The style of the whole app.">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3" role="radiogroup" aria-label="Look">
          {LOOK_NAMES.map((name, i) => {
            const on = look === name
            return (
              <button key={name} type="button" role="radio" aria-checked={on} aria-label={`${LOOKS[name].label} look`}
                tabIndex={on ? 0 : -1}
                onKeyDown={e => {
                  const to = radioKeyTarget(e.key, i, LOOK_NAMES.length)
                  if (to === null) return
                  e.preventDefault(); choose({ look: LOOK_NAMES[to] }); focusRadio(e.currentTarget, to)
                }}
                onClick={() => choose({ look: name })}
                className={`rounded-2xl border p-2 text-left transition ${on ? 'border-transparent ring-2 ring-[var(--accent-solid)]' : 'border-line hover:border-[color-mix(in_srgb,var(--fg)_25%,var(--line))]'}`}>
                <LookPreview look={name} ownFont={profile.font !== undefined && profile.font !== 'sans'} />
                <div className="mt-2 flex items-center justify-between gap-2 px-1 text-sm font-medium">{LOOKS[name].label}{on && <Check size={15} className="shrink-0 text-[var(--accent-solid)]" aria-hidden />}</div>
                <div className="px-1 pb-0.5 text-xs text-muted">{LOOKS[name].blurb}</div>
              </button>
            )
          })}
        </div>
        {mode === 'dark' && <p className="mt-2 text-xs text-muted">Paper is for light mode. Switch to light mode to use it{profile.look === 'paper' ? ' (your choice is kept)' : ''}.</p>}
      </SettingRow>
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

// A small app drawn in the look itself: the look's own colours, title face, sidebar, card and buttons apply, because it is an app-root with that data-look
function LookPreview({ look, ownFont }: { look: LookName; ownFont: boolean }) {
  return (
    <div data-look-preview data-look={look} aria-hidden className="app-root pointer-events-none flex h-32 overflow-hidden rounded-xl border border-line sm:h-36"
      style={ownFont ? undefined : ({ '--display-font': 'var(--title-font, var(--font-instrument))' } as React.CSSProperties)}>
      <div className="app-sidebar flex w-12 shrink-0 flex-col items-center gap-1.5 py-2.5">
        <span className="mb-1 size-4 rounded-md bg-accent-solid" />
        <span className="h-2.5 w-8 rounded-full bg-accent-soft" />
        {[0, 1, 2, 3].map(i => <span key={i} className="h-1.5 w-6 rounded-full bg-muted/50" />)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
        <span className="font-display text-[15px] font-semibold leading-none text-fg">Today</span>
        <div className="card space-y-1.5 !rounded-lg !p-2">
          <span className="block h-1.5 w-4/5 rounded-full bg-line" />
          <span className="block h-1.5 w-1/2 rounded-full bg-line" />
          <span className="flex gap-1 pt-0.5">
            <span className="rounded-full bg-accent-soft px-1.5 text-[8px] font-medium leading-4 text-accent">Chosen</span>
            <span className="tile-a w-6 rounded-full" />
            <span className="tile-b w-6 rounded-full" />
          </span>
        </div>
        <span className="mt-auto flex gap-1.5">
          <span className="btn-primary !min-h-0 !gap-0 !px-2.5 !py-1 !text-[9px] !leading-none">Start</span>
          <span className="btn !min-h-0 !gap-0 !px-2.5 !py-1 !text-[9px] !leading-none">Open</span>
        </span>
      </div>
    </div>
  )
}
