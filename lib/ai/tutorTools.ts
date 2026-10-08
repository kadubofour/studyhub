import { z } from 'zod'
import type OpenAI from 'openai'
import { validateQuestions } from './quiz'
import type { Question } from '@/lib/quiz/types'

export const MAX_CARDS = 30
export type ToolName = 'create_note' | 'create_flashcards' | 'create_quiz' | 'create_task'
export type ProposalArgs = {
  create_note: { title: string; body: string; course_id: string | null }
  create_flashcards: { deck_id: string | null; deck_name: string | null; cards: { front: string; back: string }[]; course_id: string | null }
  create_quiz: { title: string; questions: Question[] }
  create_task: { title: string; type: 'assignment' | 'exam' | 'reading' | 'other'; due_at: string | null; priority: 'low' | 'normal' | 'high'; course_id: string | null }
}
export type Proposal = {
  [K in ToolName]: { id: string; tool: K; args: ProposalArgs[K]; state: 'pending' | 'added' | 'discarded'; itemId?: string; itemKind?: 'note' | 'deck' | 'quiz' | 'task' }
}[ToolName]
export type ToolContext = { noteId: string | null; courseIds: string[]; deckIds: string[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const id = z.string().regex(UUID)
const text = (max: number) => z.string().trim().min(1).max(max)

const NoteArgs = z.object({ title: text(200), body: text(30_000), course_id: id.nullish() })
const CardsArgs = z.object({
  deck_id: id.nullish(), deck_name: text(120).nullish(), course_id: id.nullish(),
  cards: z.array(z.object({ front: text(1000), back: text(1000) })).min(1).max(MAX_CARDS),
})
const RawQuestion = z.object({
  type: z.enum(['mcq', 'true_false', 'short']), prompt: z.string(), options: z.array(z.string()).nullable().optional(),
  answer: z.string(), explanation: z.string(),
})
const QuizArgs = z.object({ title: text(200), questions: z.array(RawQuestion).min(1).max(30) })
// A plain date ("2030-05-17") means 09:00 that day (UTC); a full date-time is kept
const dueAt = z.preprocess(v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T09:00:00.000Z` : v), z.string().datetime({ offset: true }).nullish())
const TaskArgs = z.object({
  title: text(300), type: z.enum(['assignment', 'exam', 'reading', 'other']).nullish(), priority: z.enum(['low', 'normal', 'high']).nullish(),
  due_date: dueAt, course_id: id.nullish(),
})

export function parseToolCall(name: string, argsJson: string, ctx: ToolContext, pid: string): Proposal | null {
  let raw: unknown
  try { raw = JSON.parse(argsJson) } catch { return null }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const ownsCourse = (c: string | null | undefined) => !c || ctx.courseIds.includes(c)
  const base = { id: pid, state: 'pending' as const }
  if (name === 'create_note') {
    const a = NoteArgs.safeParse(raw)
    if (!a.success || !ownsCourse(a.data.course_id)) return null
    return { ...base, tool: 'create_note', args: { title: a.data.title, body: a.data.body, course_id: a.data.course_id ?? null } }
  }
  if (name === 'create_flashcards') {
    const a = CardsArgs.safeParse(raw)
    if (!a.success || !ownsCourse(a.data.course_id)) return null
    const { deck_id, deck_name } = a.data
    if (!deck_id && !deck_name) return null
    if (deck_id && !ctx.deckIds.includes(deck_id)) return null
    return { ...base, tool: 'create_flashcards', args: { deck_id: deck_id ?? null, deck_name: deck_id ? null : deck_name ?? null, cards: a.data.cards, course_id: a.data.course_id ?? null } }
  }
  if (name === 'create_quiz') {
    if (!ctx.noteId) return null
    const a = QuizArgs.safeParse(raw)
    if (!a.success) return null
    const questions = validateQuestions(a.data.questions.map(q => ({ ...q, options: q.options ?? null })), ['mcq', 'true_false', 'short'], 30)
    if (questions.length < 3) return null
    return { ...base, tool: 'create_quiz', args: { title: a.data.title, questions } }
  }
  if (name === 'create_task') {
    const a = TaskArgs.safeParse(raw)
    if (!a.success || !ownsCourse(a.data.course_id)) return null
    return { ...base, tool: 'create_task', args: { title: a.data.title, type: a.data.type ?? 'other', due_at: a.data.due_date ?? null, priority: a.data.priority ?? 'normal', course_id: a.data.course_id ?? null } }
  }
  return null
}

const fn = (name: ToolName, description: string, properties: Record<string, unknown>, required: string[]): OpenAI.Responses.Tool =>
  ({ type: 'function', name, description, strict: false, parameters: { type: 'object', properties, required, additionalProperties: false } })
const course = { type: ['string', 'null'], description: 'id of one of the student\'s courses, or null' }

// What the model may ask for. Each call becomes a proposal the student approves; nothing is saved by the call itself.
export function toolDefinitions(hasNote: boolean): OpenAI.Responses.Tool[] {
  const tools = [
    fn('create_note', 'Propose a new note for the student, only when they ask for one or agree to one. Markdown, maths as LaTeX between $...$.',
      { title: { type: 'string' }, body: { type: 'string', description: 'Markdown' }, course_id: course }, ['title', 'body']),
    fn('create_flashcards', `Propose flashcards (up to ${MAX_CARDS}), only when the student asks. Use deck_id for one of their decks, or deck_name for a new deck.`,
      { deck_id: { type: ['string', 'null'] }, deck_name: { type: ['string', 'null'] }, course_id: course,
        cards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'], additionalProperties: false } } }, ['cards']),
  ]
  if (hasNote) {
    tools.push(fn('create_quiz', 'Propose a quiz on the note this chat is about (at least 3 questions), only when the student asks. mcq has exactly 4 distinct options and "answer" is the exact text of the right one; true_false has options null and answer "true"/"false"; short has options null.',
      { title: { type: 'string' }, questions: { type: 'array', items: { type: 'object', properties: {
        type: { type: 'string', enum: ['mcq', 'true_false', 'short'] }, prompt: { type: 'string' }, options: { type: ['array', 'null'], items: { type: 'string' } },
        answer: { type: 'string' }, explanation: { type: 'string' } }, required: ['type', 'prompt', 'options', 'answer', 'explanation'], additionalProperties: false } } }, ['title', 'questions']))
  }
  tools.push(fn('create_task', 'Propose one task or deadline for the student\'s planner, only when they ask.',
    { title: { type: 'string' }, type: { type: 'string', enum: ['assignment', 'exam', 'reading', 'other'] }, due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null' },
      priority: { type: 'string', enum: ['low', 'normal', 'high'] }, course_id: course }, ['title']))
  return tools
}
