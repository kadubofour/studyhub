export type QuestionType = 'mcq' | 'true_false' | 'short'
export type Question = { id: string; type: QuestionType; prompt: string; options: string[] | null; answer: string; explanation: string }
export type AnswerRecord = { given: string; correct: boolean; feedback: string | null }
export type Quiz = { id: string; note_id: string; title: string; questions: Question[]; created_at: string }
export type QuizAttempt = {
  id: string; quiz_id: string; answers: Record<string, AnswerRecord>
  correct: number; total: number; started_at: string; finished_at: string | null
}
