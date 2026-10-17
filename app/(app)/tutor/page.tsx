'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, ClipboardList, FileText, HelpCircle, MessageSquarePlus, MessagesSquare, Search } from 'lucide-react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseTag } from '@/components/ui/CourseTag'
import { TutorPickDialog, type TutorTarget } from '@/components/tutor/TutorPickDialog'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { createChat, listChatContexts, listChats, type TutorChat } from '@/lib/data/tutor'
import { aboutLine, filterChats, type ChatContext } from '@/lib/tutor/chatList'
import { STARTERS, starterMessage } from '@/lib/tutor/starters'
import type { Course } from '@/lib/types'

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const ICONS = { explain: HelpCircle, quiz: ClipboardList, revise: BookOpenCheck, summarise: FileText } as const

export default function TutorPage() {
  const router = useRouter()
  const [chats, setChats] = useState<TutorChat[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [contexts, setContexts] = useState<Record<string, ChatContext>>({})
  const [query, setQuery] = useState('')
  const [courseId, setCourseId] = useState('')
  const [picking, setPicking] = useState<null | { starter: string | null }>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const sb = supabase()
    Promise.all([listChats(sb), listCourses(sb)]).then(async ([c, cs]) => {
      setChats(c); setCourses(cs)
      setContexts(await listChatContexts(sb, c).catch(() => ({}))) // what each is about is a nicety: the list works without it
    }).catch(() => setChats([]))
  }, [])

  async function open(input: Parameters<typeof createChat>[1], message?: string) {
    setFailed(false)
    try { router.push(`/tutor/${(await createChat(supabase(), input)).id}${message ? `?ask=${encodeURIComponent(message)}` : ''}`) } catch { setFailed(true) /* stays here; the buttons work again */ }
  }
  const start = () => open({})
  function picked(t: TutorTarget, starter: string | null) {
    setPicking(null)
    const about = { title: t.title.slice(0, 200) || 'New chat', course_id: t.course_id, ...(t.kind === 'note' ? { note_id: t.id } : t.kind === 'lecture' ? { lecture_id: t.id } : {}) }
    return open(about, starter ? starterMessage(STARTERS.find(s => s.id === starter)!, t.title) : undefined)
  }

  const withChats = useMemo(() => courses.filter(c => chats?.some(x => x.course_id === c.id)), [courses, chats])
  const shown = useMemo(() => filterChats(chats ?? [], contexts, courseId || null, query), [chats, contexts, courseId, query])
  const filtering = query.trim() !== '' || courseId !== ''

  return (
    <div>
      <PageHeader title="Tutor" actions={<>
        <button type="button" className="btn" onClick={() => setPicking({ starter: null })}><MessagesSquare size={14} aria-hidden />Chat about…</button>
        <button type="button" className="btn-primary" onClick={start}><MessageSquarePlus size={14} aria-hidden />New chat</button>
      </>} />
      {failed && <p role="alert" className="mb-3 text-sm text-danger">Couldn&apos;t start a chat. Check your connection and try again.</p>}

      <section aria-label="Ways to start" className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STARTERS.map(s => {
          const Icon = ICONS[s.id as keyof typeof ICONS]
          return (
            <button key={s.id} type="button" onClick={() => setPicking({ starter: s.id })}
              className="card flex flex-col items-start gap-1 !p-3.5 text-left transition hover:border-accent">
              <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={16} /></span>
              <span className="text-sm font-medium">{s.title}</span>
              <span className="text-xs text-muted">{s.hint}</span>
            </button>
          )
        })}
      </section>
      <p className="-mt-3 mb-5 text-xs text-muted">Pick one, then what it is about. The message is ready for you to change and send.</p>

      {chats !== null && chats.length > 0 && (
        <div className="mb-3 space-y-2">
          <label className="relative block">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" aria-label="Search chats" placeholder="Search your chats" value={query} onChange={e => setQuery(e.target.value)} className="!pl-8" />
          </label>
          {withChats.length > 1 && (
            <ChoiceChips label="Course" size="sm" value={courseId} options={[{ value: '', label: 'All courses' }, ...withChats.map(c => ({ value: c.id, label: c.name, color: c.color }))]} onChange={setCourseId} />
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

      <TutorPickDialog open={picking !== null} onClose={() => setPicking(null)} onPick={t => { void picked(t, picking?.starter ?? null) }}
        title={picking?.starter ? STARTERS.find(s => s.id === picking.starter)!.title : 'Chat about…'}
        // a starter can go on without anything chosen: its message is ready, to finish in the chat
        onSkip={picking?.starter ? () => { const s = STARTERS.find(x => x.id === picking.starter)!; setPicking(null); void open({}, starterMessage(s, null)) } : undefined} />
    </div>
  )
}
