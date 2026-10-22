'use client'
import { supabase } from '@/lib/supabase/client'
import { fileKind } from '@/lib/import/fileKind'
import { countPdfPagesInBrowser, prepareImage } from '@/lib/scan/scanClient'
import { ATTACH_LIMITS, pagesOf, shortenDocument, type Attachment } from './attachments'

// In the browser: files and photos the student adds to a tutor message, before and while it is sent.
// A photo or PDF keeps its File until it is uploaded; `sent` is the uploaded attachment, so Try again does not upload it twice.
export type Pending =
  | { id: string; kind: 'photo'; name: string; pages: 1; file?: File; preview?: string; sent?: Extract<Attachment, { kind: 'photo' }> }
  | { id: string; kind: 'pdf'; name: string; pages: number; file?: File; sent?: Extract<Attachment, { kind: 'pdf' }> }
  | { id: string; kind: 'document'; name: string; text: string; shortened?: boolean }

const TYPES = 'Add photos (JPEG, PNG, WebP), PDFs, or Word, PowerPoint and text files.'
const preview = (f: File) => (typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : undefined)

/** Reads one picked, pasted or dropped file into something to attach, or says why it can't be */
export async function readFile(file: File): Promise<Pending | { error: string }> {
  const id = crypto.randomUUID()
  const kind = fileKind(file)
  if (kind === 'audio') return { error: "Audio and video can't be added here. Record lectures in Lectures." }
  if (!kind) {
    const old = /\.(doc|ppt)$/i.exec(file.name)?.[1]?.toLowerCase()
    return { error: old ? `Old .${old} files can't be read. Save it as .${old}x first.` : TYPES }
  }
  try {
    if (kind === 'image') return { id, kind: 'photo', name: file.name, pages: 1, file, preview: preview(file) }
    if (kind === 'pdf') {
      if (file.size > ATTACH_LIMITS.pdfBytes) return { error: 'This PDF is larger than 24 MB.' }
      return { id, kind: 'pdf', name: file.name, pages: await countPdfPagesInBrowser(file), file }
    }
    const buf = await file.arrayBuffer()
    const md = kind === 'docx' ? (await (await import('@/lib/import/docxToNote')).docxToNote(buf, file.name)).content_md
      : kind === 'pptx' ? (await (await import('@/lib/import/pptxToNote')).pptxToNote(buf, file.name)).content_md
        : (await import('@/lib/import/textToNote')).textToNote(buf, file.name).content_md
    if (!md.trim()) return { error: `${file.name} has no text to read.` }
    return { id, ...shortenDocument(file.name, md) }
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : `Couldn't read ${file.name}.` }
  }
}

/** Adds one to the list if it fits: at most 4 files, and 10 photos and PDF pages together */
export function addPending(list: Pending[], next: Pending): { list: Pending[]; error?: string } {
  if (list.length >= ATTACH_LIMITS.count) return { list, error: `Up to ${ATTACH_LIMITS.count} files a message.` }
  const pages = pagesOf([...list, next] as Attachment[])
  if (pages > ATTACH_LIMITS.pages) return { list, error: `Up to ${ATTACH_LIMITS.pages} photos and PDF pages a message. This one would make ${pages}.` }
  return { list: [...list, next] }
}

/** Uploads the photos (shrunk) and PDFs not uploaded yet into the chat's folder, and returns what the message sends.
 *  All or nothing: if one upload fails, the ones made by this call are removed and it throws. */
export async function uploadAttachments(list: Pending[], userId: string, chatId: string, prepare = prepareImage): Promise<Attachment[]> {
  const bucket = supabase().storage.from('tutor-files')
  const made: string[] = []
  const fail = async (): Promise<never> => {
    if (made.length) await bucket.remove(made).catch(() => {})
    throw new Error("Couldn't upload your files. Check your connection and try again.")
  }
  const out: Attachment[] = []
  for (const p of list) {
    if (p.kind === 'document') { out.push(p.shortened ? { kind: 'document', name: p.name, text: p.text, shortened: true } : { kind: 'document', name: p.name, text: p.text }); continue }
    if (p.sent) { out.push(p.sent); continue }
    if (!p.file) return fail()
    let blob: Blob
    try { blob = p.kind === 'photo' ? await prepare(p.file) : p.file } catch (e) { if (made.length) await bucket.remove(made).catch(() => {}); throw e }
    const path = `${userId}/${chatId}/${crypto.randomUUID()}.${p.kind === 'photo' ? 'jpg' : 'pdf'}`
    const up = await bucket.upload(path, blob, { contentType: p.kind === 'photo' ? 'image/jpeg' : 'application/pdf' })
    if (up.error) return fail()
    made.push(path)
    out.push(p.kind === 'photo' ? { kind: 'photo', name: p.name, path, pages: 1 } : { kind: 'pdf', name: p.name, path, pages: p.pages })
  }
  return out
}
