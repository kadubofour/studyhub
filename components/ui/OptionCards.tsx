'use client'
import type { LucideIcon } from 'lucide-react'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'

export type OptionCard = { value: string; label: string; description: string; icon: LucideIcon }

// Pick one of a few larger choices, each with an icon and a line of explanation: a radio group drawn as cards
export function OptionCards({ label, value, options, onChange, className = '' }: {
  label: string; value: string; options: OptionCard[]; onChange: (v: string) => void; className?: string
}) {
  const current = Math.max(0, options.findIndex(o => o.value === value))
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 sm:grid-cols-3 ${className}`}>
      {options.map((o, i) => {
        const on = i === current
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(o.value)}
            onKeyDown={e => {
              const to = radioKeyTarget(e.key, i, options.length)
              if (to === null) return
              e.preventDefault(); onChange(options[to].value); focusRadio(e.currentTarget, to)
            }}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-col sm:gap-2 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-raised hover:bg-surface'}`}>
            <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-lg ${on ? 'bg-accent-solid text-white' : 'bg-surface text-muted'}`}><o.icon size={16} /></span>
            <span className="min-w-0">
              <span className={`block text-sm font-medium ${on ? 'text-accent' : ''}`}>{o.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{o.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
