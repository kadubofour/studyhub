import OpenAI from 'openai'

// Which OpenAI model does what (spec §2). Change models here only.
export const MODELS = {
  light: 'gpt-6-luna',    // summaries, flashcards, quizzes, marking
  strong: 'gpt-6.1-sol',  // PDF import, scans, lecture notes
  transcribe: 'whisper-1', // accurate lecture transcripts (segment timestamps for tap-to-seek)
} as const

export type AiClient = Pick<OpenAI, 'responses' | 'audio'>

export const isAiConfigured = () => !!process.env.OPENAI_API_KEY
export const openai = (): AiClient => new OpenAI()

export class AiRefusedError extends Error { constructor() { super('The AI declined this request.') } }
export class AiIncompleteError extends Error { constructor() { super('The AI answer was cut off.') } }
/** The AI answered, but nothing usable was left after validation (e.g. no valid quiz questions) */
export class AiEmptyError extends Error { constructor() { super('Nothing usable came back.') } }
