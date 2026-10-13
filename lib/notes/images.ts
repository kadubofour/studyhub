import type { SupabaseClient } from '@supabase/supabase-js'

// A picture in a note is written in the note's Markdown as ![alt](studyhub-image:<file>). The file is in the student's own
// folder of the private note-images bucket, and its address is worked out when it is drawn, so nothing in a note expires.
export const IMAGE_SCHEME = 'studyhub-image:'
export const IMAGE_BUCKET = 'note-images'
const LINK_SECONDS = 3600
const KEEP_MS = 50 * 60_000
const FILE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9]+)?$/ // one plain file name: no folders, no ..

export const toToken = (file: string) => `${IMAGE_SCHEME}${file}`
export const isImageToken = (src: unknown): src is string => typeof src === 'string' && src.startsWith(IMAGE_SCHEME)
export function tokenFile(src: unknown): string | null {
  if (!isImageToken(src)) return null
  const file = src.slice(IMAGE_SCHEME.length)
  return FILE.test(file) ? file : null
}
export const imagePath = (userId: string, file: string) => `${userId}/${file}`

const IMAGE = /!\[([^\]]*)\]\((studyhub-image:[^)\s]*)\)/g

// The pictures a note uses, each once
export function imageFilesIn(md: string): string[] {
  const out: string[] = []
  for (const m of md.matchAll(IMAGE)) {
    const f = tokenFile(m[2])
    if (f && !out.includes(f)) out.push(f)
  }
  return out
}

// What the AI is given: each of our pictures replaced by its description (none when it has none)
export const stripImagesForAi = (md: string) => md.replace(IMAGE, (_all, alt: string) => alt)

// Works out a picture's address from its token: a signed link, kept for 50 minutes and asked for once however many ask together.
// Anything that is not one of our tokens (a web address) comes back as it is. Null when the file cannot be reached.
export function makeImageResolver(sb: SupabaseClient, userId: string, now: () => number = Date.now) {
  const kept = new Map<string, { url: string; until: number }>()
  const asking = new Map<string, Promise<string | null>>()
  return async function resolve(src: string): Promise<string | null> {
    if (!isImageToken(src)) return src
    const file = tokenFile(src)
    if (!file) return null
    const hit = kept.get(file)
    if (hit && hit.until > now()) return hit.url
    const pending = asking.get(file)
    if (pending) return pending
    const p = (async () => {
      try {
        const { data, error } = await sb.storage.from(IMAGE_BUCKET).createSignedUrl(imagePath(userId, file), LINK_SECONDS)
        if (error || !data?.signedUrl) return null
        kept.set(file, { url: data.signedUrl, until: now() + KEEP_MS })
        return data.signedUrl
      } catch { return null } finally { asking.delete(file) }
    })()
    asking.set(file, p)
    return p
  }
}
