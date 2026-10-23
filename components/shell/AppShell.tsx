'use client'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { GraduationCap, Moon, PanelLeftClose, PanelLeftOpen, Plus, Settings, Sun } from 'lucide-react'
import { QuizStartDialog } from '@/components/quiz/QuizStartDialog'
import { ReminderHost } from '@/components/reminders/ReminderHost'
import { requestReminder } from '@/lib/reminders/events'
import { useOpenQuiz } from '@/lib/quiz/events'
import { ScanDialog } from '@/components/scan/ScanDialog'
import { UploadMaterial } from '@/components/notes/UploadMaterial'
import { TopBar } from './TopBar'
import { CommandPalette } from './CommandPalette'
import { CreateMenu, type CreateAction } from './CreateMenu'
import { Avatar } from '@/components/profile/Avatar'
import { announceScanSaved, useOpenScan, useOpenUpload } from '@/lib/scan/events'
import type { ScanTarget } from '@/lib/ai/scan'
import { useTheme } from 'next-themes'
import { OfflineBanner } from './OfflineBanner'
import { EndingBanner } from '@/components/billing/EndingBanner'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { isRecording } from '@/lib/lectures/recordingGuard'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { createNote, listNotes } from '@/lib/data/notes'
import { listDecks } from '@/lib/data/decks'
import { listLectures } from '@/lib/data/lectures'
import { ACCENTS, FONTS, contentWidthOf } from '@/lib/appearance'
import { useCoursesChanged } from '@/lib/course/events'
import { listCourses } from '@/lib/data/courses'
import { DOCK, MORE_PLACES, PLACES, isActive } from '@/lib/shell/nav'
import type { PaletteItem } from '@/lib/shell/palette'
import type { Course } from '@/lib/types'
import { useSidebarCollapsed } from '@/lib/ui/sidebarPref'
import { useLook } from '@/components/providers/useLook'

const noopSubscribe = () => () => {}
// Scan starts on what the current page holds; the student can change it in the dialog
const scanTargetFor = (path: string): ScanTarget =>
  path.startsWith('/planner') ? 'planner' : path.startsWith('/flashcards') || path.startsWith('/review') ? 'cards' : 'note'

const DO: PaletteItem[] = [
  { id: 'do:new-note', group: 'Do', label: 'New note', keywords: 'write create', run: { action: 'new-note' } },
  { id: 'do:new-deck', group: 'Do', label: 'New deck', keywords: 'flashcards create', run: { action: 'new-deck' } },
  { id: 'do:focus', group: 'Do', label: 'Start focus', keywords: 'timer pomodoro', run: { href: '/focus' } },
  { id: 'do:review', group: 'Do', label: 'Review cards', keywords: 'due flashcards', run: { href: '/review' } },
  { id: 'do:tutor', group: 'Do', label: 'Ask the tutor', keywords: 'ai chat help', run: { href: '/tutor' } },
  { id: 'do:quiz', group: 'Do', label: 'Take a quiz', keywords: 'test', run: { action: 'quiz' } },
  { id: 'do:record', group: 'Do', label: 'Record lecture', keywords: 'audio transcript', run: { action: 'record' } },
  { id: 'do:upload', group: 'Do', label: 'Upload', keywords: 'pdf slides word powerpoint file import', run: { action: 'upload' } },
  { id: 'do:scan', group: 'Do', label: 'Scan', keywords: 'photo camera pages', run: { action: 'scan' } },
  { id: 'do:task', group: 'Do', label: 'New task', keywords: 'todo assignment exam planner', run: { action: 'new-task' } },
  { id: 'do:reminder', group: 'Do', label: 'New reminder', keywords: 'remind me alarm alert', run: { action: 'new-reminder' } },
]

export function AppShell({ children, initialCollapsed = false }: { children: React.ReactNode; initialCollapsed?: boolean }) {
  const path = usePathname()
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToast()
  // A lecture is recording on this page and leaving stops it, so ask first
  const go = useCallback((href: string) => {
    if (!isRecording()) { router.push(href); return }
    void confirm({
      title: 'Stop recording?', confirmLabel: 'Leave', danger: true,
      body: 'Leaving this page stops the recording. What was recorded is kept on this device; save it from Lectures.',
    }).then(ok => { if (ok) router.push(href) })
  }, [confirm, router])
  const guard = (e: React.MouseEvent, href: string) => { if (isRecording()) { e.preventDefault(); go(href) } }

  const { resolvedTheme, setTheme } = useTheme()
  const { profile, setProfile } = useProfile()
  // The student's courses, for the palette; read again whenever one is added, renamed or deleted
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
  const [quizzing, setQuizzing] = useState(false)
  const [scanFiles, setScanFiles] = useState<File[] | undefined>(undefined)
  const [creating, setCreating] = useState<null | 'rail' | 'wide' | 'dock'>(null)
  // The sidebar: wide with names and courses, or shrunk to a rail of icons; remembered on this device
  const [collapsed, setCollapsed] = useSidebarCollapsed(initialCollapsed)
  const wide = !collapsed
  const look = useLook()
  const [palette, setPalette] = useState(false)
  const [material, setMaterial] = useState<PaletteItem[]>([])
  useOpenScan(files => { setScanFiles(files); setScanning(true) })
  useOpenUpload(() => setUploading(true))
  useOpenQuiz(() => setQuizzing(true))
  // The server can't know the theme, so the toggle shows its themed icon only after hydration
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const dark = mounted && resolvedTheme === 'dark'
  // Writing a note or taking a quiz takes the whole screen: no rail, dock or status strip
  const immersive = /^\/(notes|quiz)\/[^/]+$/.test(path)

  // Ctrl/⌘ K opens the palette from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // The student's material, read when the palette opens, so it can jump straight to a note, deck or lecture
  useEffect(() => {
    if (!palette) return
    let live = true
    const sb = supabase()
    Promise.all([listNotes(sb), listDecks(sb), listLectures(sb)]).then(([n, d, l]) => {
      if (!live) return
      const all = [
        ...n.map(x => ({ at: x.updated_at, item: { id: `note:${x.id}`, group: 'Recent' as const, label: x.title || 'Untitled', hint: 'Note', run: { href: `/notes/${x.id}` } } })),
        ...d.map(x => ({ at: x.created_at ?? '', item: { id: `deck:${x.id}`, group: 'Recent' as const, label: x.name, hint: 'Deck', run: { href: `/flashcards/${x.id}` } } })),
        ...l.map(x => ({ at: x.recorded_at, item: { id: `lecture:${x.id}`, group: 'Recent' as const, label: x.title, hint: 'Lecture', run: { href: `/lectures/${x.id}` } } })),
      ]
      setMaterial(all.sort((a, b) => b.at.localeCompare(a.at)).map(x => x.item))
    }).catch(() => {})
    return () => { live = false }
  }, [palette])

  function toggleTheme() {
    const next = dark ? 'light' : 'dark'
    setTheme(next)
    // Persist so the choice survives reloads (ProfileProvider applies profile.theme on load)
    setProfile(p => ({ ...p, theme: next }))
    updateProfile(supabase(), profile.id, { theme: next }).catch(() => {})
  }
  async function newNote() {
    try { const n = await createNote(supabase(), {}); go(`/notes/${n.id}`) } catch { toast("Couldn't create a note.") }
  }
  function act(a: CreateAction | string) {
    if (a === 'new-note') void newNote()
    else if (a === 'new-deck') go('/flashcards?new=1')
    else if (a === 'record') go('/lectures/record')
    else if (a === 'new-task') go('/planner')
    else if (a === 'new-reminder') requestReminder()
    else if (a === 'upload') setUploading(true)
    else if (a === 'scan') { setScanFiles(undefined); setScanning(true) }
    else if (a === 'quiz') setQuizzing(true)
    else if (a === 'theme') toggleTheme()
  }
  const paletteItems: PaletteItem[] = [
    ...DO,
    { id: 'do:theme', group: 'Do', label: dark ? 'Light mode' : 'Dark mode', keywords: 'theme appearance', run: { action: 'theme' } },
    ...[...PLACES, ...MORE_PLACES].map(p => ({ id: `go:${p.href}`, group: 'Go to' as const, label: p.label, keywords: p.keywords, run: { href: p.href } })),
    ...courses.map(c => ({ id: `course:${c.id}`, group: 'Courses' as const, label: c.name, hint: 'Course', run: { href: `/courses/${c.id}` } })),
    ...material,
  ]
  function run(item: PaletteItem) {
    setPalette(false)
    if ('href' in item.run) go(item.run.href)
    else act(item.run.action)
  }

  const a = ACCENTS[profile.accent] ?? ACCENTS.blue
  const appearance = {
    '--a-solid': a.solid, '--a-text': a.text, '--a-text-dark': a.textDark, '--a-soft': a.soft,
    '--a-soft-dark': a.softDark, '--a-glow': a.glow, '--app-font': `var(${(FONTS[profile.font] ?? FONTS.sans).cssVar})`,
    // titles: the display face with the default Sans; the student's own font when they picked another
    '--display-font': profile.font && profile.font !== 'sans' && FONTS[profile.font] ? `var(${FONTS[profile.font].cssVar})` : 'var(--font-instrument)',
  } as React.CSSProperties
  const lit = 'bg-accent-soft text-accent'
  const railItem = (on: boolean) => wide
    ? `group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${on ? `${lit} font-semibold` : 'text-muted hover:bg-surface hover:text-fg'}`
    : `group relative grid size-11 place-items-center rounded-xl transition ${on ? lit : 'text-muted hover:bg-surface hover:text-fg'}`
  // the name beside the icon when wide; a tooltip on the rail
  const tip = (label: string) => wide ? <span aria-hidden className="truncate">{label}</span> : (
    <span aria-hidden className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line px-2.5 py-1 text-[13px] font-medium text-fg opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100" style={{ background: 'var(--glass-strong)' }}>{label}</span>
  )
  const dockLink = (href: string) => {
    const { label, icon: Icon } = PLACES.find(p => p.href === href)!
    const on = isActive(path, href)
    return (
      <Link key={href} href={href} onClick={e => guard(e, href)} aria-label={label} aria-current={on ? 'page' : undefined}
        className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium ${on ? 'text-accent' : 'text-muted'}`}>
        <Icon size={21} aria-hidden /><span aria-hidden>{label}</span>
      </Link>
    )
  }

  return (
    <div className={`app-root min-h-dvh ${immersive ? '' : wide ? 'md:grid md:grid-cols-[260px_1fr]' : 'md:grid md:grid-cols-[72px_1fr]'}`} style={appearance} data-look={look}>
      {!immersive && (
        <nav aria-label="Studyhub" className={`app-sidebar no-print sticky top-0 hidden h-dvh flex-col gap-1.5 border-r border-line py-4 md:flex ${wide ? 'px-3' : 'items-center'}`}>
          <div className={`mb-3 flex items-center ${wide ? 'justify-between px-1' : 'flex-col gap-2'}`}>
            {/* the mark; Home is the first item below it */}
            <span className="flex items-center gap-2.5">
              <span title="Studyhub" className="grid size-10 place-items-center rounded-xl bg-accent-solid text-white"><GraduationCap size={19} aria-hidden /></span>
              {wide && <span className="font-display text-lg font-semibold tracking-tight">Studyhub</span>}
            </span>
            <button type="button" onClick={() => setCollapsed(wide)} aria-label={wide ? 'Shrink sidebar' : 'Expand sidebar'} title={wide ? 'Shrink sidebar' : 'Expand sidebar'}
              className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg">
              {wide ? <PanelLeftClose size={17} aria-hidden /> : <PanelLeftOpen size={17} aria-hidden />}
            </button>
          </div>
          <button type="button" aria-label="Create new" aria-haspopup="menu" aria-expanded={creating !== null && creating !== 'dock'} onClick={() => setCreating(c => (c ? null : wide ? 'wide' : 'rail'))}
            className={`group relative mb-3 border border-dashed border-line text-muted transition hover:border-accent hover:text-accent ${wide ? 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium' : 'grid size-11 place-items-center rounded-xl'}`}>
            <Plus size={19} aria-hidden />{tip('Create')}
          </button>
          <div className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto ${wide ? '' : 'items-center'}`}>
            {PLACES.map(({ href, label, icon: Icon }) => {
              const on = isActive(path, href)
              return (
                <Link key={href} href={href} onClick={e => guard(e, href)} aria-label={label} aria-current={on ? 'page' : undefined} className={railItem(on)}>
                  <Icon size={19} aria-hidden />{tip(label)}
                </Link>
              )
            })}
            {wide && courses.length > 0 && (
              <div role="group" aria-labelledby="nav-courses" className="mt-4 flex flex-col gap-0.5">
                <Link id="nav-courses" href="/courses" onClick={e => guard(e, '/courses')} className="px-3 pb-1 text-[13px] font-semibold text-muted hover:text-fg">Courses</Link>
                {courses.map(c => {
                  const on = isActive(path, `/courses/${c.id}`)
                  return (
                    <Link key={c.id} href={`/courses/${c.id}`} onClick={e => guard(e, `/courses/${c.id}`)} aria-current={on ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition ${on ? `${lit} font-semibold` : 'text-muted hover:bg-surface hover:text-fg'}`}>
                      <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} /><span className="truncate">{c.name}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
          <div className={`mt-2 flex flex-col gap-1 ${wide ? '' : 'items-center'}`}>
            <button type="button" onClick={toggleTheme} aria-label={dark ? 'Light mode' : 'Dark mode'} className={railItem(false)}>
              {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}{tip(dark ? 'Light mode' : 'Dark mode')}
            </button>
            <Link href="/settings" onClick={e => guard(e, '/settings')} aria-label="Settings" aria-current={isActive(path, '/settings') ? 'page' : undefined} className={railItem(isActive(path, '/settings'))}>
              <Settings size={18} aria-hidden />{tip('Settings')}
            </Link>
            <Link href="/profile" onClick={e => guard(e, '/profile')} aria-label={profile.display_name || 'Your profile'} aria-current={isActive(path, '/profile') ? 'page' : undefined}
              className={wide ? `mt-1 flex items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] transition ${isActive(path, '/profile') ? lit : 'hover:bg-surface'}` : `group relative mt-1 rounded-full ring-2 transition ${isActive(path, '/profile') ? 'ring-accent' : 'ring-transparent hover:ring-line'}`}>
              <Avatar name={profile.display_name} color={profile.avatar_color} size={wide ? 30 : 34} />{tip(profile.display_name || 'Your profile')}
            </Link>
          </div>
        </nav>
      )}
      <div className={`flex min-w-0 flex-col ${immersive ? '' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0'}`}>
        <OfflineBanner />
        {!immersive && <TopBar onSearch={() => setPalette(true)} />}
        <main className={immersive ? 'w-full' : `mx-auto w-full px-5 ${path.startsWith('/planner') ? 'max-w-none py-6 md:px-10 md:py-8' : `${{ focused: 'max-w-5xl md:px-12', wide: 'max-w-[1320px] md:px-10 xl:px-14', full: 'max-w-none md:px-10' }[contentWidthOf(profile.content_width)]} py-6 md:py-8`}`}>{!immersive && <EndingBanner />}{children}</main>
      </div>
      {!immersive && (
        <nav aria-label="Main" className="no-print glass fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto grid max-w-md grid-cols-5 items-center rounded-[22px] px-2 py-1.5 md:hidden" style={{ background: 'var(--glass-strong)' }}>
          {DOCK.slice(0, 2).map(dockLink)}
          <button type="button" aria-label="Create new" aria-haspopup="menu" aria-expanded={creating === 'dock'} onClick={() => setCreating(c => (c ? null : 'dock'))}
            className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-solid text-white">
            <Plus size={22} aria-hidden />
          </button>
          {DOCK.slice(2).map(dockLink)}
        </nav>
      )}
      {creating && <CreateMenu from={creating} onPick={act} onClose={() => setCreating(null)} />}
      {palette && <CommandPalette items={paletteItems} onRun={run} onClose={() => setPalette(false)} />}
      {quizzing && <QuizStartDialog open onClose={() => setQuizzing(false)} />}
      <ReminderHost />
      <UploadMaterial open={uploading} onClose={() => setUploading(false)} onScan={files => { setScanFiles(files); setScanning(true) }} />
      {scanning && <ScanDialog open initialFiles={scanFiles} onClose={() => { setScanning(false); setScanFiles(undefined) }} initialTarget={scanTargetFor(path)} onSaved={announceScanSaved} />}
    </div>
  )
}
