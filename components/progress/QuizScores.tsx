'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { listFinishedAttemptsSince } from '@/lib/data/quizzes'
import { listCourses } from '@/lib/data/courses'
import { quizScoresByCourse } from '@/lib/stats'
import type { Course } from '@/lib/types'

// Recent quiz scores per course, as small bar rows (height = score)
export function QuizScores() {
  const [groups, setGroups] = useState<ReturnType<typeof quizScoresByCourse> | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  useEffect(() => {
    const sb = supabase()
    const since = new Date(Date.now() - 90 * 86_400_000)
    Promise.all([listFinishedAttemptsSince(sb, since), listCourses(sb)])
      .then(([rows, cs]) => { setCourses(cs); setGroups(quizScoresByCourse(rows)) }).catch(() => setGroups([]))
  }, [])
  if (!groups || !groups.length) return null
  return (
    <section className="card">
      <h2 className="mb-3 font-semibold">Quiz scores</h2>
      <ul className="space-y-3">
        {groups.map(g => {
          const course = courses.find(c => c.id === g.course_id)
          const name = course?.name ?? 'No course'
          return (
            <li key={g.course_id ?? 'none'}>
              <div className="mb-1 text-sm">{name}</div>
              <div className="flex h-14 items-end gap-1" role="img" aria-label={`${name} quiz scores: ${g.scores.map(s => `${s.percent}%`).join(', ')}`}>
                {g.scores.map((s, i) => (
                  <div key={i} title={`${s.title}: ${s.percent}%`} className="w-5 rounded-t" style={{ height: `${Math.max(6, s.percent)}%`, background: course?.color ?? 'var(--accent-solid)' }} />
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
