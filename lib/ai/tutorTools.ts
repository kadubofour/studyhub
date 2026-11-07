import { z } from 'zod'
import type OpenAI from 'openai'
import { validateQuestions } from './quiz'
import type { Question } from '@/lib/quiz/types'

export const MAX_CARDS = 30
export type ToolName = 'create_note' | 'create_flashcards' | 'create_quiz' | 'create_task' | 'create_class' | 'create_notebook' | 'open_in_app'
export type ProposalArgs = {
  create_note: { title: string; body: string; course_id: string | null }
  create_flashcards: { deck_id: string | null; deck_name: string | null; cards: { front: string; back: string }[]; course_id: string | null }
  create_quiz: { title: string; questions: Question[] }
  create_task: { title: string; type: 'assignment' | 'exam' | 'reading' | 'other'; due_at: string | null; priority: 'low' | 'normal' | 'high'; course_id: string | null }
  create_class: { course_id: string; day_of_week: number; start_time: string; end_time: string; location: string | null; kind: 'lecture' | 'lab' | 'tutorial' | 'seminar' | 'other' }
  create_notebook: { name: string; course_id: string | null }
  open_in_app: { href: string; label: string }
}
export type Proposal = {
  [K in ToolName]: { id: string; tool: K; args: ProposalArgs[K]; state: 'pending' | 'added' | 'discarded'; itemId?: string; itemKind?: 'note' | 'deck' | 'quiz' | 'task' | 'class' | 'notebook' }
}[ToolName]
// The places a command can open: fixed paths and items by id, never an address the model wrote, so a command can only go somewhere in the app
export const PAGES = {
  home: '/home', planner: '/planner', library: '/library', flashcards: '/flashcards', review: '/review', quizzes: '/quiz', tutor: '/tutor', focus: '/focus',
  progress: '/progress', leaderboard: '/leaderboard', lectures: '/lectures', courses: '/courses', settings: '/settings', profile: '/profile',
} as const
export const ITEM_PATHS = { note: '/notes', deck: '/flashcards', quiz: '/quiz', notebook: '/notebooks', lecture: '/lectures', course: '/courses', file: '/files' } as const
export type ToolContext = { courseIds: string[]; deckIds: string[] }

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
// A plain date ("2030-05-17") is kept as a day: it becomes the end of that day in the student's own time zone when it is added (a made-up time would
// show as the start time of an exam); a full date-time is kept
const dueAt = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.string().datetime({ offset: true })]).nullish()
const TaskArgs = z.object({
  title: text(300), type: z.enum(['assignment', 'exam', 'reading', 'other']).nullish(), priority: z.enum(['low', 'normal', 'high']).nullish(),
  due_date: dueAt, course_id: id.nullish(),
})

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const ClassArgs = z.object({
  course_id: id, day_of_week: z.number().int().min(0).max(6), start_time: hhmm, end_time: hhmm,
  location: z.string().trim().max(100).nullish(), kind: z.enum(['lecture', 'lab', 'tutorial', 'seminar', 'other']).nullish(),
}).refine(c => c.end_time > c.start_time)
const OpenArgs = z.union([
  z.object({ page: z.enum(Object.keys(PAGES) as [keyof typeof PAGES, ...(keyof typeof PAGES)[]]) }),
  z.object({ item: z.enum(Object.keys(ITEM_PATHS) as [keyof typeof ITEM_PATHS, ...(keyof typeof ITEM_PATHS)[]]), id }),
])
const NotebookArgs = z.object({ name: text(80), course_id: id.nullish() })

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
  if (name === 'create_class') {
    const a = ClassArgs.safeParse(raw)
    if (!a.success || !ctx.courseIds.includes(a.data.course_id)) return null // a class belongs to one of the student's courses
    return { ...base, tool: 'create_class', args: { course_id: a.data.course_id, day_of_week: a.data.day_of_week, start_time: a.data.start_time, end_time: a.data.end_time, location: a.data.location || null, kind: a.data.kind ?? 'lecture' } }
  }
  if (name === 'create_notebook') {
    const a = NotebookArgs.safeParse(raw)
    if (!a.success || !ownsCourse(a.data.course_id)) return null
    return { ...base, tool: 'create_notebook', args: { name: a.data.name, course_id: a.data.course_id ?? null } }
  }
  if (name === 'open_in_app') {
    const a = OpenArgs.safeParse(raw)
    if (!a.success) return null
    const d = a.data
    if ('page' in d) return { ...base, tool: 'open_in_app', args: { href: PAGES[d.page], label: d.page === 'quizzes' ? 'Quizzes' : d.page[0].toUpperCase() + d.page.slice(1) } }
    if (d.item === 'course' && !ctx.courseIds.includes(d.id)) return null
    if (d.item === 'deck' && !ctx.deckIds.includes(d.id)) return null
    return { ...base, tool: 'open_in_app', args: { href: `${ITEM_PATHS[d.item]}/${d.id}`, label: d.item[0].toUpperCase() + d.item.slice(1) } }
  }
  return null
}

const fn = (name: ToolName, description: string, properties: Record<string, unknown>, required: string[]): OpenAI.Responses.Tool =>
  ({ type: 'function', name, description, strict: false, parameters: { type: 'object', properties, required, additionalProperties: false } })
const course = { type: ['string', 'null'], description: 'id of one of the student\'s courses, or null' }

// What the model may ask for. Each call becomes a proposal the student approves; nothing is saved by the call itself.
export function toolDefinitions(): OpenAI.Responses.Tool[] {
  const tools = [
    fn('create_note', 'Propose a new note for the student, only when they ask for one or agree to one. Markdown, maths as LaTeX between $...$.',
      { title: { type: 'string' }, body: { type: 'string', description: 'Markdown' }, course_id: course }, ['title', 'body']),
    fn('create_flashcards', `Propose flashcards (up to ${MAX_CARDS}), only when the student asks. Use deck_id for one of their decks, or deck_name for a new deck.`,
      { deck_id: { type: ['string', 'null'] }, deck_name: { type: ['string', 'null'] }, course_id: course,
        cards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'], additionalProperties: false } } }, ['cards']),
  ]
  tools.push(fn('create_quiz', 'Propose a quiz (at least 3 questions) on whatever the student asks for: any topic, what you have just covered, or their material. It needs no note. Only when the student asks. mcq has exactly 4 distinct options and "answer" is the exact text of the right one; true_false has options null and answer "true"/"false"; short has options null.',
    { title: { type: 'string' }, questions: { type: 'array', items: { type: 'object', properties: {
      type: { type: 'string', enum: ['mcq', 'true_false', 'short'] }, prompt: { type: 'string' }, options: { type: ['array', 'null'], items: { type: 'string' } },
      answer: { type: 'string' }, explanation: { type: 'string' } }, required: ['type', 'prompt', 'options', 'answer', 'explanation'], additionalProperties: false } } }, ['title', 'questions']))
  tools.push(fn('create_task', 'Propose one task or deadline for the student\'s planner, only when they ask.',
    { title: { type: 'string' }, type: { type: 'string', enum: ['assignment', 'exam', 'reading', 'other'] }, due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null' },
      priority: { type: 'string', enum: ['low', 'normal', 'high'] }, course_id: course }, ['title']))
  tools.push(fn('create_class', 'Propose one weekly class for the student\'s timetable, only when they ask (say, from a timetable they describe). It must belong to one of their courses (course_id).',
    { course_id: { type: 'string' }, day_of_week: { type: 'integer', description: '0 Sunday to 6 Saturday' }, start_time: { type: 'string', description: 'HH:MM, 24-hour' }, end_time: { type: 'string', description: 'HH:MM, 24-hour, after the start' },
      location: { type: ['string', 'null'] }, kind: { type: 'string', enum: ['lecture', 'lab', 'tutorial', 'seminar', 'other'] } }, ['course_id', 'day_of_week', 'start_time', 'end_time']))
  tools.push(fn('create_notebook', 'Propose a new notebook (a study set holding a subject\'s notes, decks, recordings and files), only when the student asks.',
    { name: { type: 'string' }, course_id: course }, ['name']))
  tools.push(fn('open_in_app', 'Offer to take the student somewhere in the app, when they ask to go, open, show or start something ("open my planner", "take me to my flashcards", "start a focus session", "open that note"). The student taps to go; nothing changes. Give either "page" or both "item" and "id" (an id from <material>, <courses> or <decks> only).',
    { page: { type: 'string', enum: Object.keys(PAGES), description: 'a place in the app' }, item: { type: 'string', enum: Object.keys(ITEM_PATHS) }, id: { type: 'string' } }, []))
  return tools
}
