'use client'
import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, CalendarDays, Layers, Timer, NotebookPen, BarChart3, Settings, Moon, Sun, GraduationCap,
  PanelLeftClose, PanelLeftOpen, ScanLine, Mic, MessagesSquare,
} from 'lucide-react'
import { ScanDialog } from '@/components/scan/ScanDialog'
import { announceScanSaved } from '@/lib/scan/events'
import type { ScanTarget } from '@/lib/ai/scan'
import { useTheme } from 'next-themes'
import { OfflineBanner } from './OfflineBanner'
import { PremiumBadge } from '@/components/billing/PremiumBadge'
import { EndingBanner } from '@/components/billing/EndingBanner'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { isRecording } from '@/lib/lectures/recordingGuard'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { ACCENTS, FONTS, lookOf } from '@/lib/appearance'
import { useSidebarCollapsed } from '@/lib/ui/sidebarPref'

const NAV = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/flashcards', label: 'Flashcards', icon: Layers },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/notes', label: 'Notes', icon: NotebookPen },
  { href: '/lectures', label: 'Lectures', icon: Mic },
  { href: '/tutor', label: 'Tutor', icon: MessagesSquare },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
]
// Phones: recording happens there, so Lectures takes Focus's place (Focus stays on Home)
const MOBILE = NAV.filter(n => ['/home', '/planner', '/flashcards', '/notes', '/lectures', '/tutor'].includes(n.href))
const noopSubscribe = () => () => {}
// Scan starts on what the current page holds; the student can change it in the dialog
const scanTargetFor = (path: string): ScanTarget =>
  path.startsWith('/planner') ? 'planner' : path.startsWith('/flashcards') || path.startsWith('/review') ? 'cards' : 'note'

export function AppShell({ children, initialCollapsed = false }: { children: React.ReactNode; initialCollapsed?: boolean }) {
  const path = usePathname()
  const router = useRouter()
  const confirm = useConfirm()
  // A lecture is recording on this page and leaving stops it, so ask first
  function guard(e: React.MouseEvent, href: string) {
    if (!isRecording()) return
    e.preventDefault()
    void confirm({
      title: 'Stop recording?', confirmLabel: 'Leave', danger: true,
      body: 'Leaving this page stops the recording. What was recorded is kept on this device; save it from Lectures.',
    }).then(ok => { if (ok) router.push(href) })
  }
  const { resolvedTheme, setTheme } = useTheme()
  const { profile, setProfile } = useProfile()
  const [collapsed, setCollapsed] = useSidebarCollapsed(initialCollapsed)
  const [scanning, setScanning] = useState(false)
  // The server can't know the theme, so the toggle shows its themed icon only after hydration
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const dark = mounted && resolvedTheme === 'dark'
  // Writing a note takes the whole screen: no app sidebar or tab bar
  const immersive = /^\/(notes|quiz)\/[^/]+$/.test(path)
  const sidebar = !immersive && !collapsed

  function toggleTheme() {
    const next = dark ? 'light' : 'dark'
    setTheme(next)
    // Persist so the choice survives reloads (ProfileProvider applies profile.theme on load)
    setProfile(p => ({ ...p, theme: next }))
    updateProfile(supabase(), profile.id, { theme: next }).catch(() => {})
  }
  const active = (href: string) => path === href || path.startsWith(href + '/') || (href === '/flashcards' && path.startsWith('/review'))

  const a = ACCENTS[profile.accent] ?? ACCENTS.blue
  const appearance = {
    '--a-solid': a.solid, '--a-text': a.text, '--a-text-dark': a.textDark, '--a-soft': a.soft,
    '--a-soft-dark': a.softDark, '--a-glow': a.glow, '--app-font': `var(${(FONTS[profile.font] ?? FONTS.sans).cssVar})`,
  } as React.CSSProperties

  return (
    <div className={`app-root min-h-dvh bg-bg ${sidebar ? 'md:grid md:grid-cols-[208px_1fr]' : ''}`} style={appearance} data-look={lookOf(profile.look)}>
      {sidebar && (
        <aside className="no-print sticky top-0 hidden h-dvh border-r border-line bg-surface/60 p-3 md:flex md:flex-col">
          <div className="mb-6 flex items-center justify-between px-1">
            <Link href="/home" onClick={e => guard(e, '/home')} className="flex items-center gap-2 text-[15px] font-semibold">
              <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-glow))' }}>
                <GraduationCap size={16} aria-hidden />
              </span>
              Studyhub
              <PremiumBadge />
            </Link>
            <button className="btn-ghost px-1.5" onClick={() => setCollapsed(true)} aria-label="Hide sidebar" title="Hide sidebar">
              <PanelLeftClose size={16} aria-hidden />
            </button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={e => guard(e, href)} aria-current={active(href) ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${active(href) ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface hover:text-fg'}`}>
                <Icon size={17} aria-hidden />{label}
              </Link>
            ))}
            <button type="button" onClick={() => setScanning(true)}
              className="mt-2 flex items-center gap-2.5 rounded-xl border border-dashed border-line px-2.5 py-2 text-sm text-muted transition hover:border-accent hover:text-accent">
              <ScanLine size={17} aria-hidden />Scan
            </button>
          </nav>
          <div className="mt-auto flex flex-col gap-0.5">
            <button className="btn-ghost" onClick={toggleTheme}>
              {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
            <Link href="/settings" onClick={e => guard(e, '/settings')} className={`btn-ghost ${active('/settings') ? 'text-fg' : ''}`}><Settings size={16} aria-hidden />Settings</Link>
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
        <main className={immersive ? 'w-full' : 'mx-auto w-full max-w-5xl px-4 py-5 md:px-10 md:py-9'}>{!immersive && <EndingBanner />}{children}</main>
      </div>
      {!immersive && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-raised/95 backdrop-blur md:hidden">
          {MOBILE.map(({ href, label, icon: Icon }, i) => (
            <span key={href} className="contents">
              {i === 2 && (
                <button type="button" onClick={() => setScanning(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted">
                  <ScanLine size={19} aria-hidden />Scan
                </button>
              )}
              <Link href={href} onClick={e => guard(e, href)} aria-current={active(href) ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active(href) ? 'text-accent' : 'text-muted'}`}>
                <Icon size={19} aria-hidden />{label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      {scanning && <ScanDialog open onClose={() => setScanning(false)} initialTarget={scanTargetFor(path)} onSaved={announceScanSaved} />}
    </div>
  )
}
