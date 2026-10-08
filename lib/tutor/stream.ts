import { AI_MESSAGES, AI_USED } from '@/components/ai/aiFetch'
import type { Proposal } from '@/lib/ai/tutorTools'
import type { Source } from '@/lib/ai/tutorContext'

export type TutorLine =
  | { t: 'sources'; sources: Source[] }
  | { t: 'delta'; text: string }
  | { t: 'done'; messageId?: string; proposals: Proposal[] }
  | { t: 'error'; error: string; messageId?: string }

// The route answers with one JSON object per line; a line can arrive split across chunks
export async function* readTutorStream(res: Response): AsyncGenerator<TutorLine> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const parse = (line: string): TutorLine | null => { try { return line.trim() ? JSON.parse(line) as TutorLine : null } catch { return null } }
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const p of parts) { const l = parse(p); if (l) yield l }
    if (done) break
  }
  const last = parse(buffer)
  if (last) yield last
}

export async function sendTutorMessage(chatId: string, message: string, signal?: AbortSignal): Promise<
  { ok: true; lines: AsyncGenerator<TutorLine> } | { ok: false; error: string; message: string }
> {
  try {
    const res = await fetch('/api/ai/tutor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, message }), signal })
    if (!res.ok || !res.body) {
      const error = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'ai_failed'
      return { ok: false, error, message: AI_MESSAGES[error] ?? AI_MESSAGES.ai_failed }
    }
    // Usage counters refresh once the reply is complete
    async function* lines() { yield* readTutorStream(res); window.dispatchEvent(new Event(AI_USED)) }
    return { ok: true, lines: lines() }
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') throw e
    return { ok: false, error: 'ai_failed', message: AI_MESSAGES.ai_failed }
  }
}
