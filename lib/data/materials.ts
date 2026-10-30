import type { SupabaseClient } from '@supabase/supabase-js'
import { check, fetchAll, must } from './util'

// An uploaded file kept in the Library: the original a note was made from
export type Material = { id: string; course_id: string | null; note_id: string | null; name: string; mime: string; bytes: number; path: string; created_at: string }
export type MaterialKind = 'pdf' | 'docx' | 'pptx' | 'text' | 'image'

const COLS = 'id,course_id,note_id,name,mime,bytes,path,created_at'
export const MATERIAL_MIME: Record<Exclude<MaterialKind, 'image'>, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  text: 'text/plain',
}
// What a kept file is, for its label
export const MATERIAL_LABEL: Record<string, string> = {
  [MATERIAL_MIME.pdf]: 'PDF', [MATERIAL_MIME.docx]: 'Word', [MATERIAL_MIME.pptx]: 'PowerPoint', 'text/plain': 'Text', 'text/markdown': 'Text',
  'image/jpeg': 'Photo', 'image/png': 'Photo', 'image/webp': 'Photo',
}
const PHOTO_MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// The type a kept file is stored as: a photo's own (from its name when the browser gave none), Markdown kept as Markdown
export function materialMime(file: Pick<File, 'name' | 'type'>, kind: MaterialKind): string {
  if (kind === 'image') return PHOTO_MIME[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? (Object.values(PHOTO_MIME).includes(file.type) ? file.type : 'image/jpeg')
  if (kind === 'text' && /\.(md|markdown)$/i.test(file.name)) return 'text/markdown'
  return MATERIAL_MIME[kind]
}
// What a kept file is, as the upload dialog reads files
export function kindOfMime(mime: string): MaterialKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('text/')) return 'text'
  return (Object.entries(MATERIAL_MIME).find(([, m]) => m === mime)?.[0] ?? 'pdf') as MaterialKind
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function listMaterials(sb: SupabaseClient): Promise<Material[]> {
  return fetchAll<Material>((from, to) => sb.from('materials').select(COLS).order('created_at', { ascending: false }).order('id').range(from, to))
}

export async function getMaterial(sb: SupabaseClient, id: string): Promise<Material> {
  return must(await sb.from('materials').select(COLS).eq('id', id).single())
}

// The file first, into the student's folder, then its row; a row that fails takes its file back out
export async function keepMaterial(sb: SupabaseClient, userId: string, file: File, kind: MaterialKind, at: { course_id: string | null; note_id: string | null }): Promise<Material> {
  const id = crypto.randomUUID()
  const name = file.name.slice(0, 200) || 'Uploaded file'
  const safe = name.replace(/[^\w .()-]/g, '_').slice(0, 100) || 'file'
  const path = `${userId}/${id}-${safe}`
  const mime = materialMime(file, kind)
  // re-typed, since a browser often gives a .md (or a renamed) file no type at all, which storage would refuse
  const up = await sb.storage.from('materials').upload(path, new Blob([file], { type: mime }), { contentType: mime })
  if (up.error) throw up.error
  try {
    return must(await sb.from('materials').insert({ id, name, mime, bytes: file.size, path, ...at }).select(COLS).single())
  } catch (e) {
    await sb.storage.from('materials').remove([path]).catch(() => {})
    throw e
  }
}

export async function updateMaterial(sb: SupabaseClient, id: string, patch: Partial<Pick<Material, 'name' | 'course_id' | 'note_id'>>): Promise<void> {
  check(await sb.from('materials').update(patch).eq('id', id))
}

// The file first (so nothing is left behind if that fails), then the row
export async function deleteMaterial(sb: SupabaseClient, m: Pick<Material, 'id' | 'path'>): Promise<void> {
  const { error } = await sb.storage.from('materials').remove([m.path])
  if (error) throw error
  check(await sb.from('materials').delete().eq('id', m.id))
}

// The kept file itself, to make a note from it later
export async function materialFile(sb: SupabaseClient, m: Pick<Material, 'path' | 'name' | 'mime'>): Promise<File> {
  const { data, error } = await sb.storage.from('materials').download(m.path)
  if (error || !data) throw error ?? new Error('no file')
  return new File([data], m.name, { type: m.mime })
}

// A private link to the file that lasts an hour; download names the saved file
export async function materialUrl(sb: SupabaseClient, m: Pick<Material, 'path' | 'name'>, download = false): Promise<string> {
  const { data, error } = await sb.storage.from('materials').createSignedUrl(m.path, 3600, download ? { download: m.name } : undefined)
  if (error || !data) throw error ?? new Error('no url')
  return data.signedUrl
}
