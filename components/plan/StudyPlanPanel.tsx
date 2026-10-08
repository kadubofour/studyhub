'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { AiError } from '@/components/ai/AiError'
import { PlanForm, type PlanSettings } from '@/components/plan/PlanForm'
import { KIND_LABEL, SessionRow } from '@/components/plan/SessionRow'
import { usePlans } from '@/components/plan/usePlans'
import { useWarmup } from '@/components/plan/useWarmup'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { supabase } from '@/lib/supabase/client'
import { deletePlan, savePlan } from '@/lib/plan/service'
import type { PlanView, ScheduledView } from '@/lib/plan/load'
import type { PlanMode } from '@/lib/plan/types'
import type { Course, Task } from '@/lib/types'

const MODE_LABEL: Record<PlanMode, string> = { sprint: 'Sprint', balanced: 'Balanced', deep: 'Deep dive' }
const dayLabel = (day: string) => formatInTimeZone(new Date(`${day}T12:00:00Z`), 'UTC', 'EEE d MMM')
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function Days({ days }: { days: { day: string; sessions: ScheduledView[] }[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {days.map(d => (
        <li key={d.day} className="flex gap-2">
          <span className="w-24 shrink-0 text-muted">{dayLabel(d.day)}</span>
          <span>{d.sessions.length ? d.sessions.map(s => `${KIND_LABEL[s.kind]}: ${s.topicName} (${s.minutes} min)`).join(' · ') : <span className="text-muted">Rest</span>}</span>
        </li>
      ))}
    </ul>
  )
}

// Planner: make a study plan from an exam, see today's sessions and the days ahead
export function StudyPlanPanel({ courses, tasks }: { courses: Course[]; tasks: Task[] }) {
  const confirm = useConfirm()
  const plans = usePlans()
  const warmup = useWarmup()
  const [form, setForm] = useState<{ kind: 'new'; exam: Task } | { kind: 'edit'; view: PlanView } | null>(null)
  const [full, setFull] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [now] = useState(() => Date.now()) // when the page opened: an exam is upcoming if it is after this
  const [error, setError] = useState<string | null>(null)
  const courseOf = (id: string) => courses.find(c => c.id === id)

  if (!plans.views) return null
  const views = plans.views
  const planned = new Set(views.map(v => v.courseId))
  // The earliest upcoming dated exam of each course that has no plan
  const offers = courses.flatMap(c => {
    if (planned.has(c.id)) return []
    const next = tasks.filter(t => t.type === 'exam' && t.course_id === c.id && t.due_at && new Date(t.due_at).getTime() > now && !t.done_at)
      .sort((a, b) => a.due_at!.localeCompare(b.due_at!))[0]
    return next ? [next] : []
  })

  async function save(s: PlanSettings) {
    if (!form) return
    setSaving(true); setError(null)
    try {
      if (form.kind === 'new') await savePlan(supabase(), { course_id: form.exam.course_id!, exam_task_id: form.exam.id, mode: s.mode, minutes_per_day: s.minutesPerDay, days_off: s.daysOff })
      else await savePlan(supabase(), { course_id: form.view.courseId, exam_task_id: form.view.plan.exam_task_id, mode: s.mode, minutes_per_day: s.minutesPerDay, days_off: s.daysOff }, form.view.plan.id)
      setForm(null); plans.reload()
    } catch { setError('Couldn\'t save the plan. Try again.') } finally { setSaving(false) }
  }
  async function remove(v: PlanView) {
    if (!await confirm({ title: 'Delete this study plan?', body: 'Your planned sessions and what you ticked are deleted. Your topics and notes are not touched.', confirmLabel: 'Delete', danger: true })) return
    try { await deletePlan(supabase(), v.plan.id); plans.reload() } catch { setError('Couldn\'t delete the plan. Try again.') }
  }

  const editing = form?.kind === 'edit' ? form.view : null
  return (
    <section aria-label="Study plan" className="card mt-4 space-y-4">
      <h2 className="font-semibold">Study plan</h2>
      {views.length === 0 && offers.length === 0 && <p className="text-sm text-muted">Add an exam task to a course to make a study plan.</p>}

      {views.map(v => {
        const course = courseOf(v.courseId)
        return (
          <div key={v.plan.id} className="space-y-2">
            {editing?.plan.id === v.plan.id ? (
              <PlanForm title={course?.name ?? 'Course'} examLabel={v.plan.exam.title} saving={saving} error={error}
                initial={{ mode: v.plan.mode, minutesPerDay: v.plan.minutes_per_day, daysOff: v.plan.days_off }} onSave={s => { void save(s) }} onCancel={() => { setForm(null); setError(null) }} />
            ) : (
              <>
                <p className="text-sm"><span className="font-medium">{course?.name}</span> <span className="text-muted">· {MODE_LABEL[v.plan.mode]} · {v.plan.minutes_per_day} min a day · {v.plan.exam.title} in {plural(v.daysToExam, 'day')}</span></p>
                {v.status === 'no_topics' && <p className="text-sm text-muted">Draft topics for {course?.name} on Progress first. <Link className="text-accent" href="/progress">Open Progress</Link></p>}
                {v.status === 'no_days' && <p className="text-sm text-muted">Your exam is too close for a plan.</p>}
                {v.status === 'ok' && (
                  <>
                    <div>
                      <h3 className="section-label">Today</h3>
                      {v.today.length === 0 && <p className="text-sm text-muted">Nothing planned for today.</p>}
                      {v.today.map(s => (
                        <SessionRow key={s.id} s={s} course={course} done={!!s.done_at} onToggle={() => plans.setDone(v.plan.id, s.id, !s.done_at)}
                          onWarmup={() => { void warmup.start(s) }} warmingUp={warmup.busy === s.id} />
                      ))}
                    </div>
                    {v.missed > 0 && <p className="text-sm text-muted">Missed this week: {v.missed}</p>}
                    {v.unscheduled > 0 && <p className="text-sm text-muted">{plural(v.unscheduled, 'session')} don&apos;t fit. Choose Sprint or add minutes.</p>}
                    {v.upcoming.length > 0 && <div><h3 className="section-label">Next days</h3><Days days={v.upcoming} /></div>}
                    {full === v.plan.id && <div><h3 className="section-label">Full schedule</h3><Days days={v.schedule} /></div>}
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  {v.status === 'ok' && v.schedule.length > 0 && <button type="button" className="btn" onClick={() => setFull(f => (f === v.plan.id ? null : v.plan.id))}>{full === v.plan.id ? 'Hide full schedule' : 'Full schedule'}</button>}
                  <button type="button" className="btn" onClick={() => { setError(null); setForm({ kind: 'edit', view: v }) }}>Edit plan</button>
                  <button type="button" className="btn-ghost text-danger" onClick={() => { void remove(v) }}>Delete plan</button>
                </div>
              </>
            )}
          </div>
        )
      })}

      {offers.map(exam => (
        form?.kind === 'new' && form.exam.id === exam.id
          ? <PlanForm key={exam.id} title={courseOf(exam.course_id!)?.name ?? 'Course'} examLabel={exam.title} saving={saving} error={error} onSave={s => { void save(s) }} onCancel={() => { setForm(null); setError(null) }} />
          : <button key={exam.id} type="button" className="btn" onClick={() => { setError(null); setForm({ kind: 'new', exam }) }}>Make a study plan for {exam.title}</button>
      ))}
      {warmup.error && <AiError code={warmup.error.code} message={warmup.error.message} />}
      {!form && error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  )
}
