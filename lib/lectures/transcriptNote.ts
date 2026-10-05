import { formatClock, type TranscriptLine } from './time'

// A pause this long (seconds) between lines starts a new paragraph
const PARAGRAPH_GAP = 4

// The transcript as an ordinary note, with no AI: paragraphs where the lecturer paused, each
// starting with its time so the student can find it in the recording
export function transcriptToNote(title: string, lines: TranscriptLine[]): { title: string; content_md: string } {
  const paragraphs: { start: number; texts: string[] }[] = []
  let lastEnd = -Infinity
  for (const l of lines) {
    const text = l.text.trim()
    if (!text) continue
    if (!paragraphs.length || l.start - lastEnd >= PARAGRAPH_GAP) paragraphs.push({ start: l.start, texts: [] })
    paragraphs[paragraphs.length - 1].texts.push(text)
    lastEnd = l.end
  }
  return { title, content_md: paragraphs.map(p => `*[${formatClock(p.start)}]* ${p.texts.join(' ')}`).join('\n\n') }
}
