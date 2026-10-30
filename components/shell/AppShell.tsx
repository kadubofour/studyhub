'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
import { appearanceVars, contentWidthOf } from '@/lib/appearance'
import { useCoursesChanged } from '@/lib/course/events'
import { listCourses } from '@/lib/data/courses'
import { DOCK, MORE_PLACES, PLACES, isActive } from '@/lib/shell/nav'
import type { PaletteItem } from '@/lib/shell/palette'
import type { Course } from '@/lib/types'
import { useSidebarCollapsed } from '@/lib/ui/sidebarPref'
import { useLook } from '@/components/providers/useLook'

const noopSubscribe = () => () => {}
const hasMoreBelow = (el: HTMLElement) => el.scrollTop + el.clientHeight < el.scrollHeight - 2
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
  // the sidebar slides only when the student opens or shuts it, never when a page loads
  const [toggled, setToggled] = useState(false)
  const [railTip, setRailTip] = useState<{ label: string; y: number } | null>(null) // the name beside the rail icon pointed at
  // Whether the sidebar's list of places runs on below what shows, so its bottom edge can fade to say there is more
  const placesRef = useRef<HTMLDivElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)
  useEffect(() => {
    const el = placesRef.current
    if (!el) return
    const check = () => setMoreBelow(hasMoreBelow(el))
    check()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(check)
    watch.observe(el)
    return () => watch.disconnect()
  }, [collapsed, courses.length, path])
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

  const appearance = appearanceVars(profile.accent, profile.font) as React.CSSProperties
  const lit = 'bg-accent-soft text-accent'
  const railItem = (on: boolean) => wide
    ? `group relative flex w-full shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${on ? `${lit} font-semibold` : 'text-muted hover:bg-surface hover:text-fg'}`
    : `group relative grid size-11 shrink-0 place-items-center rounded-xl transition [@media(max-height:800px)]:size-10 ${on ? lit : 'text-muted hover:bg-surface hover:text-fg'}`
  // the name beside the icon when wide
  const tip = (label: string) => wide ? <span aria-hidden className="rail-fade truncate">{label}</span> : null
  // On the rail the name shows beside the icon being pointed at or focused. It is one label fixed to the window, so the scrolling
  // list of places cannot cut it off.
  const showTip = (el: HTMLElement, label: string) => { const r = el.getBoundingClientRect(); setRailTip({ label, y: r.top + r.height / 2 }) }
  const hint = (label: string) => wide ? {} : {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTip(e.currentTarget, label), onMouseLeave: () => setRailTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(e.currentTarget, label), onBlur: () => setRailTip(null),
  }
  const sidebarToggle = (
    <button type="button" onClick={() => { setToggled(true); setCollapsed(wide); setRailTip(null) }} aria-label={wide ? 'Shrink sidebar' : 'Expand sidebar'} title={wide ? 'Shrink sidebar' : undefined}
      {...hint('Expand sidebar')} className={wide ? 'grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg' : railItem(false)}>
      {wide ? <PanelLeftClose size={17} aria-hidden /> : <PanelLeftOpen size={18} aria-hidden />}
    </button>
  )
  // The phone dock: icons only, the current place in the student's colour and drawn bolder; names are for screen readers
  const dockItem = 'grid size-12 place-items-center rounded-full transition active:scale-95'
  const dockLink = (href: string) => {
    const { label, icon: Icon } = PLACES.find(p => p.href === href)!
    const on = isActive(path, href)
    return (
      <Link key={href} href={href} onClick={e => guard(e, href)} aria-label={label} aria-current={on ? 'page' : undefined}
        className={`${dockItem} ${on ? 'text-accent-solid' : 'text-fg'}`}>
        <Icon size={24} strokeWidth={on ? 2.6 : 2} aria-hidden />
      </Link>
    )
  }

  return (
    <div className={`app-root min-h-dvh ${immersive ? '' : wide ? 'md:grid md:grid-cols-[260px_1fr]' : 'md:grid md:grid-cols-[72px_1fr]'} ${toggled ? 'rail-slide' : ''}`} style={appearance} data-look={look}>
      {!immersive && (
        <nav aria-label="Studyhub" className={`app-sidebar no-print sticky top-0 hidden h-dvh flex-col gap-1.5 overflow-x-clip border-r border-line py-4 md:flex ${wide ? 'px-3' : 'items-center'}`}>
          <div className={`mb-3 flex items-center ${wide ? 'justify-between px-1' : 'flex-col gap-2'}`}>
            {/* the mark; Home is the first item below it. On the rail the button that widens the sidebar is at the bottom. */}
            <span className="flex items-center gap-2.5">
              <span title="Studyhub" className="grid size-10 place-items-center rounded-xl bg-accent-solid text-white"><GraduationCap size={19} aria-hidden /></span>
              {wide && <span className="rail-fade whitespace-nowrap font-display text-lg font-semibold tracking-tight">Studyhub</span>}
            </span>
            {wide && sidebarToggle}
          </div>
          <button type="button" aria-label="Create new" aria-haspopup="menu" aria-expanded={creating !== null && creating !== 'dock'} onClick={() => setCreating(c => (c ? null : wide ? 'wide' : 'rail'))}
            {...hint('Create')}
            className={`group relative mb-3 border border-dashed border-line text-muted transition hover:border-accent hover:text-accent ${wide ? 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium' : 'grid size-11 place-items-center rounded-xl'}`}>
            <Plus size={19} aria-hidden />{tip('Create')}
          </button>
          {/* the places scroll when the window is short (they never squash), and the bottom edge fades while there are more below */}
          <div ref={placesRef} onScroll={e => setMoreBelow(hasMoreBelow(e.currentTarget))}
            className={`no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [@media(max-height:800px)]:gap-0.5 ${moreBelow ? '[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]' : ''} ${wide ? '' : 'items-center'}`}>
            {PLACES.map(({ href, label, icon: Icon }) => {
              const on = isActive(path, href)
              return (
                <Link key={href} href={href} onClick={e => guard(e, href)} aria-label={label} aria-current={on ? 'page' : undefined} className={railItem(on)} {...hint(label)}>
                  <Icon size={19} aria-hidden />{tip(label)}
                </Link>
              )
            })}
            {wide && courses.length > 0 && (
              <div role="group" aria-labelledby="nav-courses" className="rail-fade mt-4 flex flex-col gap-0.5">
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
            {!wide && sidebarToggle}
            <button type="button" onClick={toggleTheme} aria-label={dark ? 'Light mode' : 'Dark mode'} className={railItem(false)} {...hint(dark ? 'Light mode' : 'Dark mode')}>
              {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}{tip(dark ? 'Light mode' : 'Dark mode')}
            </button>
            <Link href="/settings" onClick={e => guard(e, '/settings')} aria-label="Settings" aria-current={isActive(path, '/settings') ? 'page' : undefined} className={railItem(isActive(path, '/settings'))} {...hint('Settings')}>
              <Settings size={18} aria-hidden />{tip('Settings')}
            </Link>
            <Link href="/profile" onClick={e => guard(e, '/profile')} aria-label={profile.display_name || 'Your profile'} data-avatar={wide ? undefined : ''} aria-current={isActive(path, '/profile') ? 'page' : undefined} {...hint(profile.display_name || 'Your profile')}
              className={wide ? `mt-1 flex items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] transition ${isActive(path, '/profile') ? lit : 'hover:bg-surface'}` : `group relative mt-1 rounded-full ring-2 transition ${isActive(path, '/profile') ? 'ring-accent' : 'ring-transparent hover:ring-line'}`}>
              <Avatar name={profile.display_name} color={profile.avatar_color} size={wide ? 30 : 34} />{tip(profile.display_name || 'Your profile')}
            </Link>
          </div>
          {!wide && railTip && (
            <span aria-hidden className="pointer-events-none fixed left-[84px] z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line px-2.5 py-1 text-[13px] font-medium text-fg shadow-lg" style={{ top: railTip.y, background: 'var(--glass-strong)' }}>{railTip.label}</span>
          )}
        </nav>
      )}
      <div className={`flex min-w-0 flex-col ${immersive ? '' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0'}`}>
        <OfflineBanner />
        {!immersive && <TopBar onSearch={() => setPalette(true)} />}
        <main className={immersive ? 'w-full' : `mx-auto w-full px-5 ${path.startsWith('/planner') ? 'max-w-none py-6 md:px-10 md:py-8' : `${{ focused: 'max-w-5xl md:px-12', wide: 'max-w-[1320px] md:px-10 xl:px-14', full: 'max-w-none md:px-10' }[contentWidthOf(profile.content_width)]} py-6 md:py-8`}`}>{!immersive && <EndingBanner />}{children}</main>
      </div>
      {!immersive && (
        <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit items-center gap-1 rounded-full border border-line bg-raised px-2 py-1 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.3)] md:hidden">
          {DOCK.slice(0, 2).map(dockLink)}
          <button type="button" aria-label="Create new" aria-haspopup="menu" aria-expanded={creating === 'dock'} onClick={() => setCreating(c => (c ? null : 'dock'))}
            className={`${dockItem} ${creating === 'dock' ? 'text-accent-solid' : 'text-fg'}`}>
            <Plus size={26} strokeWidth={creating === 'dock' ? 2.6 : 2} aria-hidden />
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
