'use client'
import { Bell, CreditCard, Database, HardDrive, Palette, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'

export type SectionId = 'appearance' | 'reminders' | 'privacy' | 'plan' | 'storage' | 'data' | 'account'
export const SETTINGS_SECTIONS: { id: SectionId; label: string; blurb: string; icon: LucideIcon }[] = [
  { id: 'appearance', label: 'Appearance', blurb: 'How Studyhub looks: its style, colour, font and how much of the screen it uses.', icon: Palette },
  { id: 'reminders', label: 'Reminders', blurb: 'What Studyhub tells you about, and when the focus timer says time is up.', icon: Bell },
  { id: 'privacy', label: 'Privacy', blurb: 'Who sees how you are doing.', icon: ShieldCheck },
  { id: 'plan', label: 'Plan', blurb: 'Your plan, what it includes and your payments.', icon: CreditCard },
  { id: 'storage', label: 'Storage', blurb: 'How much lecture audio you have stored.', icon: HardDrive },
  { id: 'data', label: 'Your data', blurb: 'Take your things out, or delete your account.', icon: Database },
  { id: 'account', label: 'Account', blurb: 'Sign out, and where the rest of your settings live.', icon: UserRound },
]

// The side of the Settings page: pick a section. A strip across the top on a phone. Plan is left out when payments are not on.
export function SettingsRail({ section, onSection, billing }: { section: SectionId; onSection: (s: SectionId) => void; billing: boolean }) {
  return (
    <nav aria-label="Settings sections" className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto lg:sticky lg:top-4 lg:flex-col lg:self-start lg:overflow-visible">
      {SETTINGS_SECTIONS.filter(s => billing || s.id !== 'plan').map(s => {
        const on = section === s.id
        return (
          <button key={s.id} type="button" aria-current={on ? 'true' : undefined} onClick={() => onSection(s.id)}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${on ? 'bg-accent-soft font-medium text-accent' : 'text-fg hover:bg-surface'}`}>
            <s.icon size={16} aria-hidden />{s.label}
          </button>
        )
      })}
    </nav>
  )
}
