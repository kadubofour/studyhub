'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getOpenAttempt, getQuiz, latestFinishedAttempt, startAttempt } from '@/lib/data/quizzes'
import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { QuizResults } from '@/components/quiz/QuizResults'
import type { Quiz, QuizAttempt } from '@/lib/quiz/types'

export default function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [previous, setPrevious] = useState<QuizAttempt | null>(null)

  useEffect(() => {
    const sb = supabase()
    getQuiz(sb, id).then(async q => {
      setQuiz(q)
      setAttempt((await getOpenAttempt(sb, q.id)) ?? (await startAttempt(sb, q))) // resume or start
    }).catch(() => router.replace('/notes'))
  }, [id, router])

  async function finished(a: QuizAttempt) {
    setPrevious(await latestFinishedAttempt(supabase(), a.quiz_id, a.id).catch(() => null))
    setAttempt(a)
  }
  async function retake() {
    if (!quiz) return
    setPrevious(null); setAttempt(await startAttempt(supabase(), quiz))
  }

  if (!quiz || !attempt) return null
  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2">
        <Link href={`/notes/${quiz.note_id}`} className="btn-ghost" aria-label="Back to note"><ArrowLeft size={17} aria-hidden /></Link>
        <span className="font-medium">{quiz.title}</span>
      </header>
      {attempt.finished_at
        ? <QuizResults quiz={quiz} attempt={attempt} previous={previous} onRetake={retake} />
        : <QuizPlayer key={attempt.id} quiz={quiz} attempt={attempt} onFinished={finished} />}
    </div>
  )
}
