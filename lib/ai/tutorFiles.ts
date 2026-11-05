import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MATERIAL_LABEL } from '@/lib/data/materials'
import { materialText } from '@/lib/import/materialText'
import type { Material } from './tutorContext'

// The files a student keeps, for the tutor: what it can see they have, and the text of the ones it needs. A file's text is taken out once, here, the first time
// it is wanted, so every file already kept becomes readable without being uploaded again. Read with the student's own session. The tutor works without any of
// this, so a failure means fewer files rather than an error.

export type FileRow = { id: string; course_id: string | null; note_id: string | null; name: string; mime: string; path: string; bytes: number; body_status: 'pending' | 'ready' | 'no_text'; created_at: string }
const COLS = 'id,course_id,note_id,name,mime,path,bytes,body_status,created_at'

const READS_PER_MESSAGE = 5 // files read for the first time on one message
const READ_BUDGET_MS = 20_000 // and no more time than this
const MOST_NAMED = 2

const plain = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const stem = (name: string) => plain(name.replace(/\.[a-z0-9]{1,5}$/i, ''))
// Words that say a file is meant without saying which
const MEANS_A_FILE = /\b(pdfs?|files?|slides?|handouts?|uploads?|uploaded|documents?|worksheets?|readings?)\b/i
const COMMON = new Set(['the', 'and', 'for', 'pdf', 'notes', 'file', 'slides', 'lecture', 'final', 'copy', 'new'])

/** The files a message is about: ones it names (by whole name, or every telling word of it); else, when it only says "the PDF", the newest one in the chat's course */
export function filesAsked(message: string, all: FileRow[], inScope: FileRow[]): FileRow[] {
  const said = ` ${plain(message)} `
  const named = all.filter(f => {
    const name = stem(f.name)
    const words = name.split(' ').filter(w => w.length >= 3 && !COMMON.has(w))
    if (!words.length) return false // a name of only everyday words ("lecture notes") could be said without meaning the file
    return said.includes(` ${name} `) || (words.length >= 2 && words.every(w => said.includes(` ${w} `)))
  })
  if (named.length) return named.slice(0, MOST_NAMED)
  return MEANS_A_FILE.test(message) ? inScope.slice(0, 1) : []
}

/** What the tutor is told about a file it can see: its name, its type, and that it has no text when it has none */
export const fileLine = (f: Pick<FileRow, 'name' | 'mime' | 'body_status'>) =>
  `${f.name} (${MATERIAL_LABEL[f.mime] ?? 'File'}${f.body_status === 'no_text' ? ', no text in it' : ''})`

// Takes a file's text out and keeps it, and gives it back. A file that cannot be fetched stays pending, to be tried again; one that cannot be read is marked.
async function readFile(sb: SupabaseClient, f: FileRow): Promise<{ status: FileRow['body_status']; body: string } | null> {
  if (f.mime.startsWith('image/')) return { status: 'no_text', body: '' }
  const { data } = await sb.storage.from('materials').download(f.path)
  if (!data) return null
  const body = await materialText(new Uint8Array(await data.arrayBuffer()), f.mime).catch(() => '')
  const status = body ? 'ready' : 'no_text'
  await sb.from('materials').update({ body: body || null, body_status: status }).eq('id', f.id)
  return { status, body }
}

export async function tutorFiles(sb: SupabaseClient, o: { courseId: string | null; message: string }): Promise<{ list: string[]; named: Material[]; scanned: FileRow[] }> {
  try {
    const { data } = await sb.from('materials').select(COLS).order('created_at', { ascending: false }).limit(100)
    const rows = (data ?? []) as FileRow[]
    const inScope = o.courseId ? rows.filter(f => f.course_id === o.courseId) : rows
    const asked = filesAsked(o.message, rows, inScope)

    // First reads: the files asked about, then the chat's course, then the rest. A file with a note made from it only when asked about: the note says the same.
    const waiting = [...new Set([...asked, ...inScope, ...rows])].filter(f => f.body_status === 'pending' && (!f.note_id || asked.includes(f))).slice(0, READS_PER_MESSAGE)
    const justRead = new Map<string, string>()
    const started = Date.now()
    for (const f of waiting) {
      if (Date.now() - started > READ_BUDGET_MS) break
      const got = await readFile(sb, f).catch(() => null)
      if (!got) continue
      f.body_status = got.status
      if (got.body) justRead.set(f.id, got.body)
    }

    const named: Material[] = []
    for (const f of asked.filter(a => a.body_status === 'ready')) {
      const text = justRead.get(f.id) ?? ((await sb.from('materials').select('body').eq('id', f.id).maybeSingle()).data as { body?: string } | null)?.body
      if (text) named.push({ kind: 'file', id: f.id, title: f.name, text })
    }
    return {
      list: inScope.slice(0, 30).map(fileLine), named,
      scanned: asked.filter(f => f.body_status === 'no_text' && f.mime === 'application/pdf'),
    }
  } catch {
    return { list: [], named: [], scanned: [] }
  }
}
