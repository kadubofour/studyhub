'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { RichEditor } from '@/components/notes/RichEditor'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { deleteNote, getNote, updateNote } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import { useAutosave } from '@/lib/ui/useAutosave'
import type { Course, EditorMode, Note } from '@/lib/types'

type Patch = Partial<Pick<Note, 'title' | 'content_md' | 'course_id'>>
const STATUS_TEXT = { idle: '', pending: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved — will retry' } as const

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  // Keyed: switching notes remounts the editor, so its autosaver always targets this note
  return <NoteEditor key={id} id={id} />
}

function NoteEditor({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const { profile } = useProfile()
  const [note, setNote] = useState<Note | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [mode, setMode] = useState<EditorMode>(profile.default_editor_mode)
  const [draft, setDraft] = useState<Note | null>(null)
  // Ref holds the latest draft: the Tiptap onUpdate callback is created once, so reading
  // `draft` state from it would merge onto a stale copy and drop title/course edits.
  const draftRef = useRef<Note | null>(null)
  const { update, status } = useAutosave<Patch>(patch => updateNote(supabase(), id, patch))

  useEffect(() => {
    const sb = supabase()
    Promise.all([getNote(sb, id), listCourses(sb)])
      .then(([n, c]) => { setNote(n); setDraft(n); draftRef.current = n; setCourses(c) })
      .catch(() => router.replace('/notes'))
  }, [id, router])

  function change(patch: Patch) {
    if (!draftRef.current) return
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
    // Always save the full editable state so the latest value of every field wins
    update({ title: next.title, content_md: next.content_md, course_id: next.course_id })
  }

  async function remove() {
    if (!confirm('Delete this note?')) return
    try { await deleteNote(supabase(), id); router.replace('/notes') } catch { toast('Couldn\'t delete the note.') }
  }

  if (!note || !draft) return null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/notes" className="btn-ghost" aria-label="Back to notes"><ArrowLeft size={16} aria-hidden /></Link>
        <select className="input" value={draft.course_id ?? ''} onChange={e => change({ course_id: e.target.value || null })} aria-label="Course">
          <option value="">No course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-xs text-muted" aria-live="polite">{STATUS_TEXT[status]}</span>
        <div className="ml-auto flex items-center gap-1">
          <div role="tablist" className="flex rounded-lg bg-surface p-0.5">
            {(['rich', 'markdown'] as EditorMode[]).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-0.5 text-sm ${mode === m ? 'bg-bg font-medium' : 'text-muted'}`}>{m === 'rich' ? 'Rich' : 'Markdown'}</button>
            ))}
          </div>
          <button className="btn-ghost text-danger" onClick={remove} aria-label="Delete note"><Trash2 size={16} aria-hidden /></button>
        </div>
      </div>
      <input className="mb-2 w-full bg-transparent text-xl font-medium outline-none" value={draft.title} placeholder="Untitled"
        onChange={e => change({ title: e.target.value })} aria-label="Title" />
      {mode === 'rich' ? (
        <RichEditor key={`rich-${note.id}`} markdown={draft.content_md} onChange={md => change({ content_md: md })} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <textarea className="input min-h-[60vh] font-mono text-[13px]" value={draft.content_md} aria-label="Markdown"
            onChange={e => change({ content_md: e.target.value })} />
          <MarkdownView source={draft.content_md} className="min-h-[60vh] border-t border-line pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0" />
        </div>
      )}
    </div>
  )
}
