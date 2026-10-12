'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, CalendarDays, Layers, Timer, NotebookPen, BarChart3, Settings, Moon, Sun, GraduationCap,
  PanelLeftClose, PanelLeftOpen, ScanLine, Mic, MessagesSquare, Upload, FolderOpen,
} from 'lucide-react'
import { ScanDialog } from '@/components/scan/ScanDialog'
import { UploadMaterial } from '@/components/notes/UploadMaterial'
import { TopBar } from './TopBar'
import { Avatar } from '@/components/profile/Avatar'
import { announceScanSaved, useOpenScan, useOpenUpload } from '@/lib/scan/events'
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
import { ACCENTS, FONTS } from '@/lib/appearance'
import { useLook } from '@/components/providers/useLook'
import { useCoursesChanged } from '@/lib/course/events'
import { listCourses } from '@/lib/data/courses'
import type { Course } from '@/lib/types'
import { useSidebarCollapsed } from '@/lib/ui/sidebarPref'

const HOME = { href: '/home', label: 'Home', icon: Home }
// The sidebar groups what the student does: planning their time, and studying
const GROUPS = [
  { label: 'Plan', items: [
    { href: '/planner', label: 'Planner', icon: CalendarDays },
    { href: '/focus', label: 'Focus', icon: Timer },
    { href: '/progress', label: 'Progress', icon: BarChart3 },
  ] },
  { label: 'Study', scan: true, items: [
    { href: '/library', label: 'Library', icon: FolderOpen },
    { href: '/notes', label: 'Notes', icon: NotebookPen },
    { href: '/lectures', label: 'Lectures', icon: Mic },
    { href: '/flashcards', label: 'Flashcards', icon: Layers },
    { href: '/tutor', label: 'Tutor', icon: MessagesSquare },
  ] },
]
const ALL = [HOME, ...GROUPS.flatMap(g => g.items)]
// Phones: recording happens there, so Lectures takes Focus's place (Focus stays on Home)
const MOBILE_ORDER = ['/home', '/planner', '/flashcards', '/notes', '/lectures', '/tutor']
const MOBILE = MOBILE_ORDER.map(h => ALL.find(n => n.href === h)!)
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
  const look = useLook()
  const [collapsed, setCollapsed] = useSidebarCollapsed(initialCollapsed)
  // The student's courses, one tap from anywhere; read again whenever one is added, renamed or deleted
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesVersion, setCoursesVersion] = useState(0)
  useCoursesChanged(() => setCoursesVersion(v => v + 1))
  useEffect(() => {
    let live = true
    listCourses(supabase()).then(c => { if (live) setCourses(c) }).catch(() => {})
    return () => { live = false }
  }, [coursesVersion])
  const [scanning, setScanning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [scanFiles, setScanFiles] = useState<File[] | undefined>(undefined)
  useOpenScan(files => { setScanFiles(files); setScanning(true) })
  useOpenUpload(() => setUploading(true))
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

  const link = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => (
    <Link key={href} href={href} onClick={e => guard(e, href)} aria-current={active(href) ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${active(href) ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface hover:text-fg'}`}>
      <Icon size={17} aria-hidden />{label}
    </Link>
  )

  const a = ACCENTS[profile.accent] ?? ACCENTS.blue
  const appearance = {
    '--a-solid': a.solid, '--a-text': a.text, '--a-text-dark': a.textDark, '--a-soft': a.soft,
    '--a-soft-dark': a.softDark, '--a-glow': a.glow, '--app-font': `var(${(FONTS[profile.font] ?? FONTS.sans).cssVar})`,
  } as React.CSSProperties

  return (
    <div className={`app-root min-h-dvh bg-bg ${sidebar ? 'md:grid md:grid-cols-[208px_1fr]' : ''}`} style={appearance} data-look={look}>
      {sidebar && (
        <aside className="app-sidebar no-print sticky top-0 hidden h-dvh border-r border-line bg-surface/60 p-3 md:flex md:flex-col">
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
          <nav className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1">
            {link(HOME)}
            {GROUPS.map(g => (
              <div key={g.label} role="group" aria-labelledby={`nav-${g.label}`} className="flex flex-col gap-0.5">
                <p id={`nav-${g.label}`} className="section-label !mb-1 px-2.5">{g.label}</p>
                {g.items.map(link)}
                {g.scan && (
                  <>
                    <button type="button" onClick={() => setUploading(true)}
                      className="mt-1 flex items-center gap-2.5 rounded-xl bg-black/30 px-2.5 py-2 text-sm text-fg transition hover:bg-black/45">
                      <Upload size={17} aria-hidden />Upload
                    </button>
                    <button type="button" onClick={() => { setScanFiles(undefined); setScanning(true) }}
                      className="flex items-center gap-2.5 rounded-xl bg-black/30 px-2.5 py-2 text-sm text-fg transition hover:bg-black/45">
                      <ScanLine size={17} aria-hidden />Scan
                    </button>
                  </>
                )}
              </div>
            ))}
            {courses.length > 0 && (
              <div role="group" aria-labelledby="nav-Courses" className="flex flex-col gap-0.5">
                <Link id="nav-Courses" href="/courses" onClick={e => guard(e, '/courses')} aria-current={path === '/courses' ? 'page' : undefined} className="section-label !mb-0 px-2.5 py-1.5 hover:underline">Courses</Link>
                {courses.map(c => (
                  <Link key={c.id} href={`/courses/${c.id}`} onClick={e => guard(e, `/courses/${c.id}`)} aria-current={active(`/courses/${c.id}`) ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm transition ${active(`/courses/${c.id}`) ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface hover:text-fg'}`}>
                    <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} /><span className="truncate">{c.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </nav>
          <div className="mt-auto flex flex-col gap-0.5">
            <Link href="/profile" onClick={e => guard(e, '/profile')} aria-current={active('/profile') ? 'page' : undefined}
              className={`mb-1 flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition ${active('/profile') ? 'bg-accent-soft font-medium text-accent' : 'text-fg hover:bg-surface'}`}>
              <Avatar name={profile.display_name} color={profile.avatar_color} size={28} />
              <span className="truncate">{profile.display_name || 'Your profile'}</span>
            </Link>
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
        {(look === 'vivid' || look === 'classic') && !immersive && <TopBar sidebarHidden={!sidebar} />}
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
      <UploadMaterial open={uploading} onClose={() => setUploading(false)} onScan={files => { setScanFiles(files); setScanning(true) }} />
      {scanning && <ScanDialog open initialFiles={scanFiles} onClose={() => { setScanning(false); setScanFiles(undefined) }} initialTarget={scanTargetFor(path)} onSaved={announceScanSaved} />}
    </div>
  )
}
