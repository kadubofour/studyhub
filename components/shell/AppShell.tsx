'use client'
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, CalendarDays, Layers, Timer, NotebookPen, BarChart3, Settings, Moon, Sun, GraduationCap,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { OfflineBanner } from './OfflineBanner'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { ACCENTS, FONTS } from '@/lib/appearance'
import { useLocalFlag } from '@/lib/ui/useLocalFlag'

const NAV = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/flashcards', label: 'Flashcards', icon: Layers },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/notes', label: 'Notes', icon: NotebookPen },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
]
const MOBILE = NAV.slice(0, 5)
const noopSubscribe = () => () => {}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { profile, setProfile } = useProfile()
  const [collapsed, setCollapsed] = useLocalFlag('studyhub.sidebar-collapsed')
  // The server can't know the theme, so the toggle shows its themed icon only after hydration
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const dark = mounted && resolvedTheme === 'dark'
  // Writing a note takes the whole screen: no app sidebar or tab bar
  const immersive = /^\/notes\/[^/]+$/.test(path)
  const sidebar = !immersive && !collapsed

  function toggleTheme() {
    const next = dark ? 'light' : 'dark'
    setTheme(next)
    // Persist so the choice survives reloads (ProfileProvider applies profile.theme on load)
    updateProfile(supabase(), profile.id, { theme: next }).then(setProfile).catch(() => {})
  }
  const active = (href: string) => path === href || path.startsWith(href + '/') || (href === '/flashcards' && path.startsWith('/review'))

  const a = ACCENTS[profile.accent] ?? ACCENTS.blue
  const appearance = {
    '--a-solid': a.solid, '--a-text': a.text, '--a-text-dark': a.textDark, '--a-soft': a.soft,
    '--a-soft-dark': a.softDark, '--a-glow': a.glow, '--app-font': `var(${(FONTS[profile.font] ?? FONTS.sans).cssVar})`,
  } as React.CSSProperties

  return (
    <div className={`app-root min-h-dvh bg-bg ${sidebar ? 'md:grid md:grid-cols-[208px_1fr]' : ''}`} style={appearance}>
      {sidebar && (
        <aside className="no-print sticky top-0 hidden h-dvh border-r border-line bg-surface/60 p-3 md:flex md:flex-col">
          <div className="mb-6 flex items-center justify-between px-1">
            <Link href="/home" className="flex items-center gap-2 text-[15px] font-semibold">
              <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-glow))' }}>
                <GraduationCap size={16} aria-hidden />
              </span>
              Studyhub
            </Link>
            <button className="btn-ghost px-1.5" onClick={() => setCollapsed(true)} aria-label="Hide sidebar" title="Hide sidebar">
              <PanelLeftClose size={16} aria-hidden />
            </button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${active(href) ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface hover:text-fg'}`}>
                <Icon size={17} aria-hidden />{label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-0.5">
            <button className="btn-ghost" onClick={toggleTheme}>
              {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
            <Link href="/settings" className={`btn-ghost ${active('/settings') ? 'text-fg' : ''}`}><Settings size={16} aria-hidden />Settings</Link>
          </div>
        </aside>
      )}
      <div className={`flex min-w-0 flex-col ${immersive ? '' : 'pb-16 md:pb-0'}`}>
        <OfflineBanner />
        {!sidebar && !immersive && (
          <button className="no-print btn-ghost fixed left-3 top-3 z-30 hidden md:inline-flex" onClick={() => setCollapsed(false)}
            aria-label="Show sidebar" title="Show sidebar">
            <PanelLeftOpen size={18} aria-hidden />
          </button>
        )}
        <main className={immersive ? 'w-full' : 'mx-auto w-full max-w-5xl px-4 py-5 md:px-10 md:py-9'}>{children}</main>
      </div>
      {!immersive && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-raised/95 backdrop-blur md:hidden">
          {MOBILE.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active(href) ? 'text-accent' : 'text-muted'}`}>
              <Icon size={19} aria-hidden />{label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
