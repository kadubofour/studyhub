'use client'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'

export type Choice = { value: string; label: string; color?: string }

// Pick one of a few options by tapping it, instead of opening a dropdown: a labelled group of chips that works like a radio group.
// On a phone they share every choice's look (.choice in globals.css).
export function ChoiceChips({ label, value, options, onChange, disabled = false, size = 'md', className = '' }: {
  label: string; value: string; options: Choice[]; onChange: (v: string) => void; disabled?: boolean; size?: 'sm' | 'md'; className?: string
}) {
  const current = Math.max(0, options.findIndex(o => o.value === value))
  const pad = size === 'sm' ? 'px-3 py-1.5 text-[13px] pointer-coarse:py-2' : 'px-3.5 py-2 text-[15px] pointer-coarse:py-2.5'
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o, i) => {
        const on = i === current && options.some(x => x.value === value)
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={i === current ? 0 : -1} disabled={disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={e => {
              const to = radioKeyTarget(e.key, i, options.length)
              if (to === null) return
              e.preventDefault(); onChange(options[to].value); focusRadio(e.currentTarget, to)
            }}
            className={`choice inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl ${pad} transition disabled:opacity-50 ${on ? 'bg-accent-soft font-medium text-accent' : 'bg-surface text-fg hover:brightness-95'}`}>
            {o.color && <span data-dot aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: o.color }} />}{o.label}
          </button>
        )
      })}
    </div>
  )
}
