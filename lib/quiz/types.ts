export type QuestionType = 'mcq' | 'true_false' | 'short'
// fullAnswer: for a short answer, the answer written as one complete, properly worded sentence (shown after it is marked, right or wrong); older quizzes have none
export type Question = { id: string; type: QuestionType; prompt: string; options: string[] | null; answer: string; explanation: string; fullAnswer?: string }
export type AnswerRecord = { given: string; correct: boolean; feedback: string | null }
export type Quiz = { id: string; note_id: string | null; title: string; questions: Question[]; created_at: string }
export type QuizAttempt = {
  id: string; quiz_id: string; answers: Record<string, AnswerRecord>
  correct: number; total: number; started_at: string; finished_at: string | null
}
