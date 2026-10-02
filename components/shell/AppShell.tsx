'use client'
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Layers, Timer, NotebookPen, BarChart3, Settings, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { OfflineBanner } from './OfflineBanner'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'

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
  // The server can't know the theme, so the toggle shows its themed icon only after hydration
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const dark = mounted && resolvedTheme === 'dark'
  function toggleTheme() {
    const next = dark ? 'light' : 'dark'
    setTheme(next)
    // Persist so the choice survives reloads (ProfileProvider applies profile.theme on load)
    updateProfile(supabase(), profile.id, { theme: next }).then(setProfile).catch(() => {})
  }
  const active = (href: string) => path === href || path.startsWith(href + '/') || (href === '/flashcards' && path.startsWith('/review'))

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[180px_1fr]">
      <aside className="hidden border-r border-line bg-surface p-3 md:flex md:flex-col">
        <div className="mb-5 px-2 text-[15px] font-medium">Studyhub</div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${active(href) ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'}`}>
              <Icon size={16} aria-hidden />{label}
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
      <div className="flex min-w-0 flex-col pb-16 md:pb-0">
        <OfflineBanner />
        <main className="mx-auto w-full max-w-4xl px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-bg md:hidden">
        {MOBILE.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active(href) ? 'text-accent' : 'text-muted'}`}>
            <Icon size={18} aria-hidden />{label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
