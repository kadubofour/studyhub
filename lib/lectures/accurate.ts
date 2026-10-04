'use client'
import { AI_MESSAGES } from '@/components/ai/aiFetch'
import type { LecturePart } from './time'

const MESSAGES: Record<string, string> = {
  premium_required: 'Accurate transcripts are a Premium feature.',
  fair_use: 'You\'ve used this month\'s 20 hours of accurate transcripts.',
}

// Transcribe the unfinished parts one by one, in order. Stops at the first part that fails, so
// a retry carries on from there; finished parts are never sent again. Cancelling throws AbortError.
export async function runAccurate(
  lecture: { id: string; parts: LecturePart[] },
  o: { onProgress: (done: number, total: number) => void; signal?: AbortSignal },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const total = lecture.parts.length
  let done = lecture.parts.filter(p => p.transcribed).length
  o.onProgress(done, total)
  for (const [i, p] of lecture.parts.entries()) {
    if (p.transcribed) continue
    const res = await fetch(`/api/lectures/${lecture.id}/transcribe?part=${i}`, { method: 'POST', signal: o.signal })
    if (!res.ok) {
      const code = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'ai_failed'
      return { ok: false, code, message: MESSAGES[code] ?? AI_MESSAGES[code] ?? AI_MESSAGES.ai_failed }
    }
    done += 1
    o.onProgress(done, total)
  }
  return { ok: true }
}
