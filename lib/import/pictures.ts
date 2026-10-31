import type { SupabaseClient } from '@supabase/supabase-js'
import { ACCEPTED, prepareImage, uploadNoteImage, type ImageIo } from '@/lib/notes/prepareImage'

// The pictures in an uploaded file (a Word document's, a slide's, a PDF page's) go into the note as pictures, where they were, instead of
// being dropped or described in words. Each is stored in the student's note-images folder, as a picture pasted into a note is.

/** Keeps one picture, giving back the Markdown that shows it (![alt](studyhub-image:…)), or null when it is left out */
export type KeepPicture = (picture: Blob, alt: string) => Promise<string | null>

export const MAX_PICTURES = 40 // a deck of slides full of photos must not fill the student's storage in one go
export const MIN_SIDE = 48 // smaller than this is a bullet, an icon or a rule, not a picture worth keeping

const altText = (alt: string) => alt.replace(/[[\]\n]+/g, ' ').trim().slice(0, 120)

/**
 * A keeper for one import: pictures smaller than MIN_SIDE are left out (decoration), the same picture twice is stored once,
 * at most MAX_PICTURES are kept, and a type a note cannot hold (GIF, BMP, TIFF…) is redrawn as PNG when the browser can read it.
 * A picture that cannot be read or stored is left out: the note is what matters.
 */
export function pictureKeeper(sb: SupabaseClient, userId: string, io?: ImageIo & { size: (b: Blob) => Promise<{ width: number; height: number } | null>; redraw: (b: Blob) => Promise<Blob | null> }): KeepPicture {
  const seen = new Map<string, Promise<string | null>>()
  let kept = 0
  const size = io?.size ?? browserSize
  const redraw = io?.redraw ?? browserRedraw
  return async (picture, alt) => {
    const key = await fingerprint(picture)
    if (!seen.has(key)) {
      seen.set(key, (async () => {
        // the place is taken before anything is awaited, so pictures arriving together cannot all slip in
        if (kept >= MAX_PICTURES) return null
        kept++
        const dims = await size(picture).catch(() => null)
        if (!dims || dims.width < MIN_SIDE || dims.height < MIN_SIDE) { kept--; return null }
        try {
          const usable = ACCEPTED.includes(picture.type) ? picture : await redraw(picture)
          if (!usable) { kept--; return null }
          return await uploadNoteImage(sb, userId, await prepareImage(usable, io))
        } catch { kept--; return null }
      })())
    }
    const token = await seen.get(key)!
    return token ? `![${altText(alt)}](${token})` : null
  }
}

// The same picture, however often it appears: its size and a sample of its bytes
async function fingerprint(b: Blob): Promise<string> {
  const head = new Uint8Array(await b.slice(0, 4096).arrayBuffer())
  let h = 2166136261
  for (const x of head) h = Math.imul(h ^ x, 16777619)
  return `${b.size}:${b.type}:${h >>> 0}`
}

async function browserSize(b: Blob) {
  const bmp = await createImageBitmap(b)
  const out = { width: bmp.width, height: bmp.height }
  bmp.close()
  return out
}
async function browserRedraw(b: Blob): Promise<Blob | null> {
  const bmp = await createImageBitmap(b).catch(() => null)
  if (!bmp) return null
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width; canvas.height = bmp.height
  canvas.getContext('2d')?.drawImage(bmp, 0, 0)
  bmp.close()
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

/** A media type from a file name in an Office file (ppt/media/image3.jpeg) */
export function mediaType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml', emf: 'image/emf', wmf: 'image/wmf' } as Record<string, string>)[ext] ?? 'application/octet-stream'
}
