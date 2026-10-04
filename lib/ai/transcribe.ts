import { toFile } from 'openai'
import { MODELS, type AiClient } from './openai'
import type { LecturePart, TranscriptLine } from '@/lib/lectures/time'

const round = (n: number) => Math.round(n * 100) / 100

// One part of a lecture → its lines, timed from the start of the whole lecture, and the seconds
// OpenAI heard (what fair use counts)
export async function transcribePart(client: AiClient, audio: Buffer, o: { name: string; mime: string; start: number; signal?: AbortSignal }): Promise<{ lines: TranscriptLine[]; seconds: number }> {
  const res = await client.audio.transcriptions.create({
    file: await toFile(audio, o.name, { type: o.mime }),
    model: MODELS.transcribe,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  }, { signal: o.signal })
  const lines = (res.segments ?? [])
    .map(s => ({ start: round(s.start + o.start), end: round(s.end + o.start), text: s.text.trim() }))
    .filter(l => l.text)
  return { lines, seconds: Math.ceil(res.duration ?? 0) }
}

// When every part is done, their lines in time order are the transcript
export function mergeParts(parts: LecturePart[]): TranscriptLine[] {
  return parts.flatMap(p => p.segments ?? []).sort((a, b) => a.start - b.start)
}
