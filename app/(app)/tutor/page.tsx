'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageSquarePlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseTag } from '@/components/ui/CourseTag'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { createChat, listChats, type TutorChat } from '@/lib/data/tutor'
import type { Course } from '@/lib/types'

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function TutorPage() {
  const router = useRouter()
  const [chats, setChats] = useState<TutorChat[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  useEffect(() => {
    const sb = supabase()
    Promise.all([listChats(sb), listCourses(sb)]).then(([c, cs]) => { setChats(c); setCourses(cs) }).catch(() => setChats([]))
  }, [])
  async function start() {
    try { router.push(`/tutor/${(await createChat(supabase(), {})).id}`) } catch { /* stays here; the button works again */ }
  }
  return (
    <div>
      <PageHeader title="Tutor" actions={<button type="button" className="btn-primary" onClick={start}><MessageSquarePlus size={14} aria-hidden />New chat</button>} />
      {chats?.length === 0 && <p className="card py-10 text-center text-sm text-muted">No chats yet. Ask the tutor about a note, or start a new chat.</p>}
      <ul className="space-y-2">
        {chats?.map(c => (
          <li key={c.id}>
            <Link href={`/tutor/${c.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-accent">
              <span className="font-medium">{c.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted">
                <CourseTag course={courses.find(x => x.id === c.course_id)} />
                <span>{day(c.updated_at)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
