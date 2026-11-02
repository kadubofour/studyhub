'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { CalendarPlus } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { PlanForm, type PlanSettings } from '@/components/plan/PlanForm'
import { KIND_ICON, KIND_LABEL, SessionRow } from '@/components/plan/SessionRow'
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

const dayName = (day: string) => formatInTimeZone(new Date(`${day}T12:00:00Z`), 'UTC', 'EEE')
const dayNumber = (day: string) => formatInTimeZone(new Date(`${day}T12:00:00Z`), 'UTC', 'd')
const dayMonth = (day: string) => formatInTimeZone(new Date(`${day}T12:00:00Z`), 'UTC', 'MMM')

// The days ahead: each with its date on a small tile, its sessions one to a line, and how long the day is
function Days({ days, color }: { days: { day: string; sessions: ScheduledView[] }[]; color?: string }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface/60">
      {days.map(d => {
        const total = d.sessions.reduce((n, s) => n + s.minutes, 0)
        return (
          <li key={d.day} aria-label={dayLabel(d.day)} className="flex items-start gap-3 px-3 py-2.5">
            <span aria-hidden className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-raised py-1 leading-none">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{dayName(d.day)}</span>
              <span className="mt-0.5 text-[17px] font-semibold">{dayNumber(d.day)}</span>
              <span className="text-[10px] text-muted">{dayMonth(d.day)}</span>
            </span>
            <span className="min-w-0 flex-1 space-y-1 pt-0.5 text-[14px]">
              {d.sessions.length === 0 && <span className="block text-muted">Rest</span>}
              {d.sessions.map((s, i) => {
                const Icon = KIND_ICON[s.kind]
                return (
                  <span key={i} className="flex items-center gap-2">
                    <Icon size={14} aria-hidden className="shrink-0" style={{ color: color ?? 'var(--accent-solid)' }} />
                    <span className="min-w-0 truncate">{`${KIND_LABEL[s.kind]}: ${s.topicName} (${s.minutes} min)`}</span>
                  </span>
                )
              })}
            </span>
            {total > 0 && <span className="shrink-0 pt-1 text-[13px] text-muted">{total} min</span>}
          </li>
        )
      })}
    </ul>
  )
}

// Planner: make a study plan for any course, working towards an exam or keeping going without one; see today's sessions and the days ahead
export function StudyPlanPanel({ courses, tasks }: { courses: Course[]; tasks: Task[] }) {
  const confirm = useConfirm()
  const plans = usePlans()
  const warmup = useWarmup()
  const [form, setForm] = useState<{ kind: 'new'; course: Course } | { kind: 'edit'; view: PlanView } | null>(null)
  const [full, setFull] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [now] = useState(() => Date.now()) // when the page opened: an exam is upcoming if it is after this
  const [error, setError] = useState<string | null>(null)
  const courseOf = (id: string) => courses.find(c => c.id === id)

  if (!plans.views) return null
  // If the plans could not be loaded the panel cannot know which courses already have one, so it offers nothing
  if (plans.failed) return (
    <section aria-label="Study plan" className="mt-4 space-y-2 rounded-2xl bg-raised p-4">
      <h2 className="font-display text-xl font-bold tracking-tight">Study plan</h2>
      <p role="alert" className="text-sm text-danger">Couldn&apos;t load your study plans. Check your connection.</p>
      <button type="button" className="btn" onClick={plans.reload}>Try again</button>
    </section>
  )
  const views = plans.views
  const planned = new Set(views.map(v => v.courseId))
  // Every course without a plan can have one, exams or not
  const offers = courses.filter(c => !planned.has(c.id) && !c.id.startsWith('temp-'))
  // A course's saved, dated, upcoming exams, soonest first: what a plan can work towards
  const examsOf = (courseId: string) => tasks
    .filter(t => t.type === 'exam' && !t.id.startsWith('temp-') && t.course_id === courseId && t.due_at && new Date(t.due_at).getTime() > now && !t.done_at)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!))

  async function save(s: PlanSettings) {
    if (!form) return
    setSaving(true); setError(null)
    try {
      const settings = { exam_task_id: s.examId, mode: s.mode, minutes_per_day: s.minutesPerDay, days_off: s.daysOff }
      if (form.kind === 'new') await savePlan(supabase(), { course_id: form.course.id, ...settings })
      else await savePlan(supabase(), { course_id: form.view.courseId, ...settings }, form.view.plan.id)
      setForm(null); plans.reload()
    } catch { setError('Couldn\'t save the plan. Try again.') } finally { setSaving(false) }
  }
  async function remove(v: PlanView) {
    if (!await confirm({ title: 'Delete this study plan?', body: 'Your planned sessions and what you ticked are deleted. Your topics and notes are not touched.', confirmLabel: 'Delete', danger: true })) return
    try { await deletePlan(supabase(), v.plan.id); plans.reload() } catch { setError('Couldn\'t delete the plan. Try again.') }
  }

  const editing = form?.kind === 'edit' ? form.view : null
  return (
    <section aria-label="Study plan" className="mt-4 space-y-4">
      <h2 className="font-display text-2xl font-bold tracking-tight">Study plan</h2>
      {views.length === 0 && offers.length === 0 && <p className="text-sm text-muted">Add a course to make a study plan.</p>}

      {views.map(v => {
        const course = courseOf(v.courseId)
        return (
          <div key={v.plan.id} className={editing?.plan.id === v.plan.id ? 'space-y-2' : 'space-y-3 rounded-2xl bg-raised p-4'}>
            {editing?.plan.id === v.plan.id ? (
              <PlanForm title={course?.name ?? 'Course'} exams={examsOf(v.courseId)} saving={saving} error={error}
                initial={{ mode: v.plan.mode, minutesPerDay: v.plan.minutes_per_day, daysOff: v.plan.days_off, examId: v.examDay ? v.plan.exam_task_id : null }} onSave={s => { void save(s) }} onCancel={() => { setForm(null); setError(null) }} />
            ) : (
              <>
                <div>
                  <h3 className="flex items-center gap-2 text-[17px] font-semibold"><span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: course?.color ?? 'var(--accent-solid)' }} />{course?.name}</h3>
                  <p className="mt-1.5 flex flex-wrap gap-1.5 text-[13px]">
                    <span className="rounded-full bg-surface px-2.5 py-1">{MODE_LABEL[v.plan.mode]}</span>
                    <span className="rounded-full bg-surface px-2.5 py-1">{v.plan.minutes_per_day} min a day</span>
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">{v.plan.exam && v.daysToExam !== null ? `${v.plan.exam.title} in ${plural(v.daysToExam, 'day')}` : 'Ongoing, no exam'}</span>
                  </p>
                </div>
                {v.status === 'no_topics' && <p className="text-sm text-muted">Find topics for {course?.name} on Progress first. <Link className="text-accent" href="/progress">Open Progress</Link></p>}
                {v.status === 'no_days' && <p className="text-sm text-muted">{v.examDay ? 'Your exam is too close for a plan.' : 'There are no study days in the next two weeks.'}</p>}
                {v.status === 'ok' && (
                  <>
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between px-1">
                        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Today</h3>
                        {v.today.length > 0 && <span className="text-[13px] text-muted">{v.today.filter(x => x.done_at).length} of {v.today.length} done</span>}
                      </div>
                      {v.today.length > 0 && (
                        <div role="progressbar" aria-label="Today's progress" aria-valuemin={0} aria-valuemax={v.today.length} aria-valuenow={v.today.filter(x => x.done_at).length} className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(v.today.filter(x => x.done_at).length / v.today.length) * 100}%`, background: course?.color ?? 'var(--accent-solid)' }} />
                        </div>
                      )}
                      {v.today.length === 0 && <p className="rounded-xl bg-surface/60 px-3 py-3 text-sm text-muted">Nothing planned for today.</p>}
                      {v.today.length > 0 && <div className="divide-y divide-line overflow-hidden rounded-xl bg-surface/60">
                        {v.today.map(x => (
                          <SessionRow key={x.id} s={x} course={course} showCourse={false} done={!!x.done_at} onToggle={() => plans.setDone(v.plan.id, x.id, !x.done_at)}
                            onWarmup={() => { void warmup.start(x) }} warmingUp={warmup.busy === x.id} />
                        ))}
                      </div>}
                    </div>
                    {v.missed > 0 && <p className="rounded-xl bg-surface/60 px-3 py-2 text-sm text-muted">Missed this week: {v.missed}</p>}
                    {v.unscheduled > 0 && <p className="rounded-xl bg-surface/60 px-3 py-2 text-sm text-muted">{plural(v.unscheduled, 'session')} don&apos;t fit. Choose Sprint or add minutes.</p>}
                    {v.upcoming.length > 0 && <div><h3 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Next days</h3><Days days={v.upcoming} color={course?.color} /></div>}
                    {full === v.plan.id && <div><h3 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Full schedule</h3><Days days={v.schedule} color={course?.color} /></div>}
                  </>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {v.status === 'ok' && v.schedule.length > 0 && <button type="button" className="btn !rounded-full" onClick={() => setFull(f => (f === v.plan.id ? null : v.plan.id))}>{full === v.plan.id ? 'Hide full schedule' : 'Full schedule'}</button>}
                  <button type="button" className="btn !rounded-full" onClick={() => { setError(null); setForm({ kind: 'edit', view: v }) }}>Edit plan</button>
                  <button type="button" className="btn-ghost !rounded-full text-danger" onClick={() => { void remove(v) }}>Delete plan</button>
                </div>
              </>
            )}
          </div>
        )
      })}

      {offers.map(c => (
        form?.kind === 'new' && form.course.id === c.id
          // works towards the course's next exam when it has one; the student can choose another or none
          ? <PlanForm key={c.id} title={c.name} exams={examsOf(c.id)} initial={{ examId: examsOf(c.id)[0]?.id ?? null }} saving={saving} error={error} onSave={s => { void save(s) }} onCancel={() => { setForm(null); setError(null) }} />
          : <button key={c.id} type="button" aria-label={`Make a study plan for ${c.name}`} className="flex w-full items-center gap-3 rounded-2xl bg-raised p-3.5 text-left active:bg-surface" onClick={() => { setError(null); setForm({ kind: 'new', course: c }) }}>
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c.color} 18%, transparent)`, color: c.color }}><CalendarPlus size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{c.name}</span><span className="block text-[13px] text-muted">Make a study plan</span></span>
            </button>
      ))}
      {warmup.error && <AiError code={warmup.error.code} message={warmup.error.message} />}
      {!form && error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  )
}
