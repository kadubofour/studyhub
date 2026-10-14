import { stripImagesForAi } from '@/lib/notes/images'
import { stripMarkupForAi } from '@/lib/notes/markup'

// Long notes are cut so a request stays within limits and cost
const MAX_CHARS = 60_000

// Pictures are not sent: each becomes its description. Student text goes inside a tag, so the model treats it as material to work from, not as instructions
export function noteInput(title: string, md: string): string {
  const safeTitle = title.replace(/"/g, "'").slice(0, 200)
  return `<note title="${safeTitle}">\n${stripMarkupForAi(stripImagesForAi(md)).slice(0, MAX_CHARS)}\n</note>`
}

export function wordCount(md: string): number {
  return (md.match(/[\p{L}\p{N}]+/gu) ?? []).length
}
