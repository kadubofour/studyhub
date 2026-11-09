'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AudioLines, MessageSquarePlus, MessagesSquare } from 'lucide-react'
import { StarterChips } from '@/components/tutor/StarterChips'
import { CourseFilter } from '@/components/tutor/CourseFilter'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseTag } from '@/components/ui/CourseTag'
import { TutorPickDialog, type TutorTarget } from '@/components/tutor/TutorPickDialog'
import { useLiveTutor } from '@/components/voice/LiveTutorProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { useCoursesChanged } from '@/lib/course/events'
import { useChatsChanged } from '@/lib/tutor/events'
import { createChat, listChatContexts, listChats, type TutorChat } from '@/lib/data/tutor'
import { aboutLine, filterChats, type ChatContext } from '@/lib/tutor/chatList'
import { STARTERS, starterMessage, type Starter } from '@/lib/tutor/starters'
import type { Course } from '@/lib/types'
import { ChatMark, ComposeButton, PhoneCount, PhoneEmpty, PhoneGroup, PhoneRow, PhoneSearch, PhoneTitle, tick } from '@/components/ui/PhoneList'
import { groupByDate, rowDate } from '@/lib/notes/noteRows'
import { showsComputer, showsPhone, useScreen } from '@/lib/ui/useScreen'

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function TutorPage() {
  const router = useRouter()
  const [chats, setChats] = useState<TutorChat[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [contexts, setContexts] = useState<Record<string, ChatContext>>({})
  const [courseId, setCourseId] = useState('')
  const [picking, setPicking] = useState<null | { starter: string | null }>(null)
  const [failed, setFailed] = useState(false)

  const [version, setVersion] = useState(0) // a chat or a course renamed or deleted somewhere else (a right click) reads the list again
  useChatsChanged(() => setVersion(v => v + 1))
  useCoursesChanged(() => setVersion(v => v + 1))
  useEffect(() => {
    const sb = supabase()
    Promise.all([listChats(sb), listCourses(sb)]).then(async ([c, cs]) => {
      setChats(c); setCourses(cs)
      setContexts(await listChatContexts(sb, c).catch(() => ({}))) // what each is about is a nicety: the list works without it
    }).catch(() => setChats(prev => prev ?? []))
  }, [version])

  async function open(input: Parameters<typeof createChat>[1], message?: string) {
    setFailed(false)
    try { router.push(`/tutor/${(await createChat(supabase(), input)).id}${message ? `?ask=${encodeURIComponent(message)}` : ''}`) } catch { setFailed(true) /* stays here; the buttons work again */ }
  }
  const start = () => open({})
  const voice = useLiveTutor()
  // A live session in a chat of its own: nothing is opened, the session fills the screen and the chat appears in the list
  async function talk() {
    setFailed(false)
    try { const c = await createChat(supabase(), {}); setChats(list => [c, ...(list ?? [])]); voice.start(c.id) } catch { setFailed(true) }
  }
  function picked(t: TutorTarget, starter: string | null) {
    setPicking(null)
    const about = { title: t.title.slice(0, 200) || 'New chat', course_id: t.course_id, ...(t.kind === 'note' ? { note_id: t.id } : t.kind === 'lecture' ? { lecture_id: t.id } : {}) }
    return open(about, starter ? starterMessage(STARTERS.find(s => s.id === starter)!, t.title) : undefined)
  }

  // A quiz can be on anything, so Quiz me goes straight to a chat to say what on; the others first ask what they are about
  function pickStarter(st: Starter) {
    if (st.id === 'quiz') void open({}, starterMessage(st, null))
    else setPicking({ starter: st.id })
  }

  const withChats = useMemo(() => courses.filter(c => chats?.some(x => x.course_id === c.id)), [courses, chats])
  const shown = useMemo(() => filterChats(chats ?? [], contexts, courseId || null, ''), [chats, contexts, courseId])
  const filtering = courseId !== ''
  const screen = useScreen()
  const [q, setQ] = useState('')
  const [now] = useState(() => new Date())
  const phoneShown = useMemo(() => filterChats(chats ?? [], contexts, courseId || null, q), [chats, contexts, courseId, q])
  const phoneGroups = q.trim() ? [{ label: '', notes: phoneShown }] : groupByDate(phoneShown, now)

  return (
    <div>
      {/* a phone gets the list notes apps have: the starters in a row that scrolls, then the chats by day */}
      {showsPhone(screen) && <div className="pb-24 md:hidden">
        <PhoneTitle title="Tutor" menuLabel="Tutor options" menu={[
          { label: 'Voice chat', icon: AudioLines, onSelect: () => { void talk() } },
          { label: 'Chat about…', icon: MessagesSquare, onSelect: () => setPicking({ starter: null }) },
          ...(withChats.length > 1 ? ['sep' as const, tick('All courses', !courseId, () => setCourseId('')), ...withChats.map(c => tick(c.name, courseId === c.id, () => setCourseId(c.id)))] : []),
        ]} />
        {failed && <p role="alert" className="mb-3 text-sm text-danger">Couldn&apos;t start a chat. Check your connection and try again.</p>}
        <PhoneSearch label="Search chats" value={q} onChange={setQ} />
        <section aria-label="Ways to start" className="mb-5">
          <StarterChips label="Start with" onPick={pickStarter} />
        </section>
        {chats?.length === 0 && <PhoneEmpty>No chats yet. Pick a way to start above, or tap the button below.</PhoneEmpty>}
        {chats && chats.length > 0 && phoneShown.length === 0 && <PhoneEmpty>No chats match.</PhoneEmpty>}
        {phoneGroups.map(g => g.notes.length > 0 && (
          <PhoneGroup key={g.label || 'all'} label={g.label} name="Chats">
            {g.notes.map(c => (
              <PhoneRow key={c.id} href={`/tutor/${c.id}`} title={c.title} mark={<ChatMark color={courses.find(x => x.id === c.course_id)?.color} />}
                date={rowDate(c.updated_at, now)} line={aboutLine(contexts[c.id]) || courses.find(x => x.id === c.course_id)?.name} />
            ))}
          </PhoneGroup>
        ))}
        <PhoneCount n={phoneShown.length} one="chat" many="chats" />
        <ComposeButton label="New chat" icon={MessageSquarePlus} onClick={() => { void start() }} />
      </div>}
      {showsComputer(screen) && <div className="max-md:hidden">      <PageHeader title="Tutor" actions={<>
        <button type="button" className="btn" onClick={() => { void talk() }}><AudioLines size={14} aria-hidden />Voice chat</button>
        <button type="button" className="btn" onClick={() => setPicking({ starter: null })}><MessagesSquare size={14} aria-hidden />Chat about…</button>
        <button type="button" className="btn-primary" onClick={start}><MessageSquarePlus size={14} aria-hidden />New chat</button>
      </>} />
      {failed && <p role="alert" className="mb-3 text-sm text-danger">Couldn&apos;t start a chat. Check your connection and try again.</p>}

      <section aria-label="Ways to start" className="mb-5 space-y-1.5">
        <StarterChips label="Start with" onPick={pickStarter} />
        <p className="text-xs text-muted">Pick one, then what it is about. The message is ready for you to change and send.</p>
      </section>

      {chats !== null && chats.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="section-label !mb-0">Your chats</h2>
            <span className="text-sm text-muted" aria-live="polite">{filtering ? `${shown.length} of ${chats.length}` : chats.length === 1 ? '1 chat' : `${chats.length} chats`}</span>
          </div>
          {withChats.length > 1 && (
            <CourseFilter label="Show chats from" value={courseId}
              options={[{ value: '', label: 'All courses', count: chats.length }, ...withChats.map(c => ({ value: c.id, label: c.name, color: c.color, count: chats.filter(x => x.course_id === c.id).length }))]}
              onChange={setCourseId} />
          )}
        </div>
      )}

      {chats?.length === 0 && <EmptyState icon={MessagesSquare} tone="a" title="Ask anything about your courses" body="No chats yet. Pick a way to start above, or start a new chat." />}
      {chats && chats.length > 0 && shown.length === 0 && filtering && <p className="card text-sm text-muted">No chats match.</p>}
      <ul className="space-y-2">
        {shown.map(c => {
          const about = aboutLine(contexts[c.id])
          return (
            <li key={c.id}>
              <Link href={`/tutor/${c.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-accent">
                <span className="min-w-0">
                  <span className="block font-medium">{c.title}</span>
                  {about && <span className="block truncate text-xs text-muted">{about}</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <CourseTag course={courses.find(x => x.id === c.course_id)} />
                  <span>{day(c.updated_at)}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      </div>}

      <TutorPickDialog open={picking !== null} onClose={() => setPicking(null)} onPick={t => { void picked(t, picking?.starter ?? null) }}
        title={picking?.starter ? STARTERS.find(s => s.id === picking.starter)!.title : 'Chat about…'}
        // a starter can go on without anything chosen: its message is ready, to finish in the chat
        onSkip={picking?.starter ? () => { const s = STARTERS.find(x => x.id === picking.starter)!; setPicking(null); void open({}, starterMessage(s, null)) } : undefined} />
    </div>
  )
}
