import { NextResponse } from 'next/server'
import { readOwnNote } from '@/lib/ai/routeNote'
import { namesFile, readOwnFile } from '@/lib/ai/routeFile'
import { MIN_WORDS_FOR_CARDS, noteToFlashcards } from '@/lib/ai/flashcards'
import { wordCount } from '@/lib/ai/input'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { removeSummary } from '@/lib/notes/summaryBlock'

export const maxDuration = 60

// POST { noteId } or { materialId } (an uploaded file) → { cards: [{front, back}] }, or 422 too_short / AI error codes
export async function POST(request: Request) {
  if (await namesFile(request)) {
    const f = await readOwnFile(request)
    if ('response' in f) return f.response
    if (wordCount(f.file.content_md) < MIN_WORDS_FOR_CARDS) return NextResponse.json({ error: 'too_short' }, { status: 422 })
    const made = await runAiAction(client => noteToFlashcards(client, f.file, request.signal), { userId: f.userId, cost: 1, signal: request.signal })
    return made.ok ? NextResponse.json(made.value) : aiErrorResponse(made.error)
  }
  const r = await readOwnNote(request)
  if ('response' in r) return r.response
  if (wordCount(removeSummary(r.note.content_md)) < MIN_WORDS_FOR_CARDS) return NextResponse.json({ error: 'too_short' }, { status: 422 })
  const result = await runAiAction(client => noteToFlashcards(client, r.note, request.signal), { userId: r.userId, cost: 1, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
