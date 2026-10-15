'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { createRetryQuiz, getOpenAttempt, getQuiz, latestFinishedAttempt, startAttempt } from '@/lib/data/quizzes'
import { missedQuestions } from '@/lib/quiz/summary'
import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { QuizResults } from '@/components/quiz/QuizResults'
import type { Quiz, QuizAttempt } from '@/lib/quiz/types'

export default function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [previous, setPrevious] = useState<QuizAttempt | null>(null)

  // Strict mode runs the effect twice; both runs share one load so only one attempt is ever started
  const boot = useRef<{ id: string; run: Promise<{ q: Quiz; a: QuizAttempt }> } | null>(null)
  useEffect(() => {
    let live = true
    const sb = supabase()
    if (boot.current?.id !== id) {
      boot.current = { id, run: getQuiz(sb, id).then(async q => ({ q, a: (await getOpenAttempt(sb, q.id)) ?? (await startAttempt(sb, q)) })) } // resume or start
    }
    boot.current.run.then(({ q, a }) => { if (live) { setQuiz(q); setAttempt(a) } }).catch(() => { if (live) router.replace('/notes') })
    return () => { live = false }
  }, [id, router])

  async function finished(a: QuizAttempt) {
    setPrevious(await latestFinishedAttempt(supabase(), a.quiz_id, a.id).catch(() => null))
    setAttempt(a)
  }
  async function retake() {
    if (!quiz) return
    setPrevious(null); setAttempt(await startAttempt(supabase(), quiz))
  }

  // A new quiz of only the questions that were missed: copied, so nothing is written by AI
  async function retryMissed() {
    if (!quiz || !attempt) return
    const sb = supabase()
    const again = await createRetryQuiz(sb, quiz, missedQuestions(quiz, attempt))
    router.push(`/quiz/${again.id}`)
  }

  if (!quiz || !attempt) return null
  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2">
        <Link href={`/notes/${quiz.note_id}`} className="btn-ghost" aria-label="Back to note"><ArrowLeft size={17} aria-hidden /></Link>
        <span className="font-medium">{quiz.title}</span>
      </header>
      {attempt.finished_at
        ? <QuizResults quiz={quiz} attempt={attempt} previous={previous} onRetake={retake} onRetryMissed={retryMissed} />
        : <QuizPlayer key={attempt.id} quiz={quiz} attempt={attempt} onFinished={finished} />}
    </div>
  )
}
