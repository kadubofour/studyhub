import type { SupabaseClient } from '@supabase/supabase-js'
import { IMAGE_BUCKET, imagePath, toToken } from './images'

export const MAX_SIDE = 1600
export const MAX_BYTES = 5 * 1024 * 1024
export const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export type ImageErrorCode = 'type' | 'big' | 'unreadable'
export class ImageError extends Error {
  constructor(public code: ImageErrorCode) { super(code) }
}
// What to tell the student for each reason a picture was not added
export const IMAGE_ERROR_TEXT: Record<ImageErrorCode, string> = {
  type: 'Only PNG, JPEG and WebP pictures can go in a note.',
  big: 'That picture is too big. Pictures can be up to 5 MB.',
  unreadable: 'That picture could not be opened.',
}

// Opening a picture and saving it again: the browser's canvas in the app, a stand-in in tests
export type ImageIo = {
  decode: (file: Blob) => Promise<{ width: number; height: number; source: unknown }>
  encode: (source: unknown, width: number, height: number, type: string, quality: number) => Promise<Blob | null>
}

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

// A picture ready to store: PNG, JPEG or WebP, shrunk to 1600 px on the long side and saved as WebP, and under 5 MB. Throws an ImageError.
export async function prepareImage(file: Blob, io: ImageIo = browserImageIo): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new ImageError('type')
  let decoded: Awaited<ReturnType<ImageIo['decode']>>
  try { decoded = await io.decode(file) } catch { throw new ImageError('unreadable') }
  const { width, height } = fitWithin(decoded.width, decoded.height, MAX_SIDE)
  const out = await io.encode(decoded.source, width, height, 'image/webp', 0.85).catch(() => null)
  const best = out ?? file
  if (best.size > MAX_BYTES) throw new ImageError('big')
  return best
}

// Stores a picture in the student's own folder and gives back the token to write in the note
export async function uploadNoteImage(sb: SupabaseClient, userId: string, blob: Blob): Promise<string> {
  const file = `${crypto.randomUUID()}.${EXT[blob.type] ?? 'png'}`
  const { error } = await sb.storage.from(IMAGE_BUCKET).upload(imagePath(userId, file), blob, { contentType: blob.type })
  if (error) throw error
  return toToken(file)
}

export async function removeNoteImages(sb: SupabaseClient, userId: string, files: string[]): Promise<void> {
  if (files.length === 0) return
  await sb.storage.from(IMAGE_BUCKET).remove(files.map(f => imagePath(userId, f)))
}

// The real thing, in the browser
const browserImageIo: ImageIo = {
  async decode(file) {
    const bmp = await createImageBitmap(file)
    return { width: bmp.width, height: bmp.height, source: bmp }
  },
  encode(source, width, height, type, quality) {
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.resolve(null)
    ctx.drawImage(source as ImageBitmap, 0, 0, width, height)
    return new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b && b.type === type ? b : null), type, quality))
  },
}
