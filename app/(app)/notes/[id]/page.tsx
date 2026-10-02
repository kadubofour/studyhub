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
import { NOTES_CHANGED } from '@/components/notes/NotesSidebar'
import { ExportMenu } from '@/components/notes/ExportMenu'

const notifyList = () => { window.dispatchEvent(new Event(NOTES_CHANGED)) }
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
  const { update, status } = useAutosave<Patch>(patch => updateNote(supabase(), id, patch).then(notifyList))

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
    try { await deleteNote(supabase(), id); notifyList(); router.replace('/notes') } catch { toast('Couldn\'t delete the note.') }
  }

  // Esc leaves the full-screen editor (menus and dialogs handle their own Esc first)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return
      router.push('/notes')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  if (!note || !draft) return null

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur md:px-6">
        <Link href="/notes" className="btn-ghost" aria-label="Back to notes" title="Back to notes (Esc)"><ArrowLeft size={17} aria-hidden /></Link>
        <select className="input max-w-44" value={draft.course_id ?? ''} onChange={e => change({ course_id: e.target.value || null })} aria-label="Course">
          <option value="">No course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-xs text-muted" aria-live="polite">{STATUS_TEXT[status]}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div role="tablist" className="flex rounded-xl bg-surface p-0.5">
            {(['rich', 'markdown'] as EditorMode[]).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`rounded-lg px-2.5 py-1 text-sm ${mode === m ? 'bg-raised font-medium shadow-sm' : 'text-muted'}`}>{m === 'rich' ? 'Rich' : 'Markdown'}</button>
            ))}
          </div>
          <ExportMenu ids={[note.id]} />
          <button className="btn-ghost text-danger" onClick={remove} aria-label="Delete note"><Trash2 size={16} aria-hidden /></button>
        </div>
      </header>
      <div className={`mx-auto px-5 pb-24 pt-8 md:px-8 ${mode === 'rich' ? 'max-w-3xl' : 'max-w-6xl'}`}>
        <input className="mb-1 w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-muted" value={draft.title} placeholder="Untitled"
          onChange={e => change({ title: e.target.value })} aria-label="Title" />
        {mode === 'rich' ? (
          <RichEditor key={`rich-${note.id}`} markdown={draft.content_md} onChange={md => change({ content_md: md })} />
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <textarea className="input min-h-[70vh] font-mono text-[13px]" value={draft.content_md} aria-label="Markdown"
              onChange={e => change({ content_md: e.target.value })} />
            <MarkdownView source={draft.content_md} className="min-h-[70vh] border-t border-line pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0" />
          </div>
        )}
      </div>
    </div>
  )
}
