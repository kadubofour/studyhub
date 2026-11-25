'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AiError } from '@/components/ai/AiError'
import { postAi } from '@/components/ai/aiFetch'
import { PlanForm, type PlanSettings } from '@/components/plan/PlanForm'
import { TopicEditor } from '@/components/progress/TopicEditor'
import { Working } from '@/components/ui/Working'
import { supabase } from '@/lib/supabase/client'
import { listCourseMaterial, listTopicStats, saveCourseTopics } from '@/lib/data/topics'
import { fromAi, tidy } from '@/lib/topics/edit'
import type { CourseMaterial, DraftTopic, TopicDraft } from '@/lib/topics/types'
import type { Course } from '@/lib/types'

type Stage =
  | { at: 'checking' }
  | { at: 'finding' }
  | { at: 'review'; list: TopicDraft[]; material: CourseMaterial }
  | { at: 'failed'; code: string; message: string }
  | { at: 'settings' }

// "Plan this course" in one go: if the course has no topics yet they are found from its notes, lectures and uploaded files and shown to be
// checked and saved (nothing is kept until the student presses Save), then the plan's settings are chosen and the plan is made. A course that
// already has topics goes straight to the settings.
export function PlanCourseFlow({ course, exams, initialExamId, saving, error, onSave, onCancel }: {
  course: Course; exams: { id: string; title: string }[]; initialExamId: string | null; saving: boolean; error: string | null
  onSave: (s: PlanSettings) => void; onCancel: () => void
}) {
  const [stage, setStage] = useState<Stage>({ at: 'checking' })
  const [attempt, setAttempt] = useState(0)
  const [savingTopics, setSavingTopics] = useState(false)
  const [topicsError, setTopicsError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const go = (s: Stage) => { if (live) setStage(s) }
    ;(async () => {
      const sb = supabase()
      try {
        // A failed read is not an empty course: drafting then could replace topics that are really there
        if ((await listTopicStats(sb, course.id)).length > 0) return go({ at: 'settings' })
      } catch { return go({ at: 'failed', code: 'load_failed', message: 'Couldn\'t load this course. Check your connection.' }) }
      go({ at: 'finding' })
      const r = await postAi<{ topics: DraftTopic[] }>('/api/ai/topics', { courseId: course.id, mode: 'draft' })
      if (!r.ok) return go({ at: 'failed', code: r.error, message: r.message })
      try { go({ at: 'review', list: fromAi(r.value.topics), material: await listCourseMaterial(sb, course.id) }) }
      catch { go({ at: 'failed', code: 'load_failed', message: 'Couldn\'t load this course. Check your connection.' }) }
    })()
    return () => { live = false }
  }, [course.id, attempt])

  async function saveTopics(list: TopicDraft[]) {
    setSavingTopics(true); setTopicsError(null)
    try { await saveCourseTopics(supabase(), course.id, tidy(list)); setStage({ at: 'settings' }) }
    catch { setTopicsError('Couldn\'t save. Your changes are still here; try again.') }
    finally { setSavingTopics(false) }
  }

  if (stage.at === 'settings') return <PlanForm title={course.name} exams={exams} initial={{ examId: initialExamId }} saving={saving} error={error} onSave={onSave} onCancel={onCancel} />

  return (
    <div className="space-y-3 rounded-2xl bg-raised p-4">
      <h3 className="font-display text-xl font-bold tracking-tight">{course.name}</h3>
      {(stage.at === 'checking' || stage.at === 'finding') && (
        <Working kind="write" size="sm" label="Finding your topics" className="text-sm text-muted"
          steps={['Reading the notes, lectures and files', 'Grouping them by idea', 'Naming each topic']} />
      )}
      {stage.at === 'review' && (
        <>
          <p className="text-sm text-muted">These are the topics your plan will be built from. Change them if you like, then save to choose your plan.</p>
          <TopicEditor initial={stage.list} material={stage.material} fresh saving={savingTopics} error={topicsError} onSave={list => { void saveTopics(list) }} onCancel={onCancel} />
        </>
      )}
      {stage.at === 'failed' && (
        <>
          {stage.code === 'too_little'
            ? <p role="alert" className="text-sm">A plan needs something to plan from. Add at least two notes, lectures or files to {course.name}, then try again. <Link className="text-accent" href="/library">Open Library</Link></p>
            : <AiError code={stage.code} message={stage.message} />}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn !rounded-full" onClick={onCancel}>Cancel</button>
            {stage.code !== 'daily_limit' && stage.code !== 'fair_use' && <button type="button" className="btn-primary !rounded-full" onClick={() => { setStage({ at: 'checking' }); setAttempt(a => a + 1) }}>Try again</button>}
          </div>
        </>
      )}
    </div>
  )
}
