'use client'
import { useEffect, useState } from 'react'
import { Presentation } from 'lucide-react'
import { postAi } from '@/components/ai/aiFetch'
import { AiError } from '@/components/ai/AiError'
import { LessonPlayer } from '@/components/tutor/LessonPlayer'
import { Working } from '@/components/ui/Working'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { deleteLesson, lessonVoices, type Lesson } from '@/lib/data/lessons'
import type { LessonScript } from '@/lib/lesson/script'

/** Short replies ("Yes.", "Sure, here you go") are not worth drawing */
export const MIN_LESSON_CHARS = 60

// Under one of the tutor's replies: a button to have it explained visually (a drawing that builds up with a voice), and once made,
// the lesson itself, which can be hidden and watched again whenever the chat is open.
export function MessageLesson({ chatId, messageId, content, lesson, onMade, onRemoved }: {
  chatId: string; messageId: string; content: string; lesson?: Lesson
  onMade: (lesson: Lesson) => void; onRemoved: (id: string) => void
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const [making, setMaking] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [voices, setVoices] = useState<(string | null)[] | null>(null)

  // The voices are private links that last an hour, asked for when the lesson is first opened
  useEffect(() => {
    if (!open || !lesson || voices) return
    let live = true
    lessonVoices(supabase(), lesson.script).then(v => { if (live) setVoices(v) }).catch(() => { if (live) setVoices(lesson.script.steps.map(() => null)) })
    return () => { live = false }
  }, [open, lesson, voices])

  async function make() {
    setMaking(true); setError(null)
    const r = await postAi<{ id: string; script: LessonScript }>('/api/ai/lesson', { chatId, messageId })
    setMaking(false)
    if (!r.ok) { setError({ code: r.error, message: r.message }); return }
    onMade({ id: r.value.id, chat_id: chatId, message_id: messageId, title: r.value.script.title, script: r.value.script, created_at: new Date().toISOString() })
    setOpen(true)
  }

  async function remove() {
    if (!lesson) return
    if (!await confirm({ title: 'Delete this lesson?', body: `“${lesson.title}” and its voice are deleted. The reply stays.`, confirmLabel: 'Delete lesson', danger: true })) return
    try { await deleteLesson(supabase(), lesson); onRemoved(lesson.id); setOpen(false); setVoices(null) } catch { toast('Couldn\'t delete the lesson.') }
  }

  if (making) return <Working kind="draw" label="Making your lesson" steps={['Planning the steps', 'Drawing the diagram', 'Recording the voice']} className="rounded-2xl border border-line bg-raised py-5" />
  return (
    <div className="space-y-2">
      {lesson
        ? <button type="button" className="btn !min-h-0 !py-1.5 text-xs" aria-expanded={open} onClick={() => setOpen(o => !o)}><Presentation size={14} aria-hidden />{open ? 'Hide lesson' : 'Watch lesson'}</button>
        : content.trim().length >= MIN_LESSON_CHARS && <button type="button" className="btn !min-h-0 !py-1.5 text-xs" title="A drawing that builds up step by step, with a voice (uses 2 AI actions)" onClick={() => { void make() }}><Presentation size={14} aria-hidden />Explain visually</button>}
      {error && <AiError code={error.code} message={error.message} />}
      {lesson && open && (voices
        ? <LessonPlayer script={lesson.script} voices={voices} onDelete={() => { void remove() }} />
        : <Working kind="load" size="sm" label="Opening the lesson" className="text-sm text-muted" />)}
    </div>
  )
}
