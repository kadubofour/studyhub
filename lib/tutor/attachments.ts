// Files and photos added to a tutor message. Shared by the browser (checks before anything uploads) and the server (checks again).
// Photos and PDFs live in the private "tutor-files" bucket at "<user id>/<chat id>/<file>"; a document (Word, PowerPoint, text)
// is read in the browser and kept as its text.

export type Attachment =
  | { kind: 'photo'; name: string; path: string; pages: 1 }
  | { kind: 'pdf'; name: string; path: string; pages: number }
  | { kind: 'document'; name: string; text: string; shortened?: boolean }

export const ATTACH_LIMITS = {
  count: 4, // attachments in one message
  pages: 10, // photos and PDF pages the tutor reads in one turn, counting attachments it reads again
  pdfBytes: 24 * 1024 * 1024,
  docChars: 30_000,
  resendQuestions: 2, // earlier questions whose attachments the tutor reads again, so a follow-up still has them
}

export const pagesOf = (list: Attachment[]) => list.reduce((n, a) => n + (a.kind === 'document' ? 0 : a.pages), 0)

/** A document's text, cut to the limit; `shortened` says it was */
export function shortenDocument(name: string, text: string): Extract<Attachment, { kind: 'document' }> {
  return text.length > ATTACH_LIMITS.docChars
    ? { kind: 'document', name, text: text.slice(0, ATTACH_LIMITS.docChars), shortened: true }
    : { kind: 'document', name, text }
}

const EXT = { photo: 'jpg', pdf: 'pdf' } as const
const plainName = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200) : '')

/** The attachments a request sends, checked: in this student's folder for this chat, the right kind of file, within the limits.
 *  Nothing sent is no attachments; anything wrong is null (the request is refused). */
export function checkAttachments(raw: unknown, userId: string, chatId: string): Attachment[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw) || raw.length > ATTACH_LIMITS.count) return null
  const folder = `${userId}/${chatId}/`
  const out: Attachment[] = []
  for (const r of raw as Record<string, unknown>[]) {
    const name = plainName(r?.name)
    if (!name) return null
    if (r.kind === 'document') {
      if (typeof r.text !== 'string' || !r.text.trim() || r.text.length > ATTACH_LIMITS.docChars) return null
      out.push(r.shortened === true ? { kind: 'document', name, text: r.text, shortened: true } : { kind: 'document', name, text: r.text })
      continue
    }
    if (r.kind !== 'photo' && r.kind !== 'pdf') return null
    const path = r.path
    if (typeof path !== 'string' || !path.startsWith(folder)) return null
    const file = path.slice(folder.length)
    if (!file || file.includes('/') || file.includes('..') || !file.toLowerCase().endsWith(`.${EXT[r.kind]}`)) return null
    const pages = r.kind === 'photo' ? 1 : Number(r.pages)
    if (!Number.isInteger(pages) || pages < 1 || pages > ATTACH_LIMITS.pages) return null
    out.push(r.kind === 'photo' ? { kind: 'photo', name, path, pages: 1 } : { kind: 'pdf', name, path, pages })
  }
  return pagesOf(out) > ATTACH_LIMITS.pages ? null : out
}

/** Which earlier questions' attachments the tutor reads again (their places in the history, newest first): the last few that had any,
 *  as long as they fit in the pages left beside this message's own */
export function resendable(history: { role: 'user' | 'assistant'; attachments?: Attachment[] }[], pagesNow: number): number[] {
  const out: number[] = []
  let left = ATTACH_LIMITS.pages - pagesNow
  for (let i = history.length - 1; i >= 0 && out.length < ATTACH_LIMITS.resendQuestions; i--) {
    const atts = history[i].role === 'user' ? history[i].attachments ?? [] : []
    if (!atts.length) continue
    const pages = pagesOf(atts)
    if (pages > left) continue
    left -= pages
    out.push(i)
  }
  return out
}
