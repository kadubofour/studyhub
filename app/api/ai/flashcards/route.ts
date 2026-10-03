import { NextResponse } from 'next/server'
import { readOwnNote } from '@/lib/ai/routeNote'
import { MIN_WORDS_FOR_CARDS, noteToFlashcards } from '@/lib/ai/flashcards'
import { wordCount } from '@/lib/ai/input'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { removeSummary } from '@/lib/notes/summaryBlock'

export const maxDuration = 60

// POST { noteId } → { cards: [{front, back}] }, or 422 too_short / AI error codes
export async function POST(request: Request) {
  const r = await readOwnNote(request)
  if ('response' in r) return r.response
  if (wordCount(removeSummary(r.note.content_md)) < MIN_WORDS_FOR_CARDS) return NextResponse.json({ error: 'too_short' }, { status: 422 })
  const result = await runAiAction(r.sb, client => noteToFlashcards(client, r.note, request.signal), { signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
