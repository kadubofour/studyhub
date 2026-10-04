'use client'
import { useRef, useState } from 'react'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { supabase } from '@/lib/supabase/client'
import { createNote } from '@/lib/data/notes'
import type { Course } from '@/lib/types'
import type { ScanNoteResult } from '@/lib/ai/scan'

// A scanned note: check the title, text and course before it's saved
export function NoteReview({ result, courses, onSaved, onScanAgain }: {
  result: ScanNoteResult; courses: Course[]; onSaved: (noteId: string) => void; onScanAgain: () => void
}) {
  const [title, setTitle] = useState(result.title)
  const [text, setText] = useState(result.content_md)
  const [courseId, setCourseId] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  async function save() {
    if (savingRef.current) return
    savingRef.current = true; setSaving(true); setError(null)
    try {
      const n = await createNote(supabase(), { title: title.trim() || 'Scanned note', content_md: text, course_id: courseId || null })
      onSaved(n.id)
    } catch {
      setError('Couldn\'t save the note. Try again.')
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {result.truncated && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs">This may be incomplete — check the end before saving.</p>}
      <label className="field"><span>Title</span><input value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="field"><span>Course</span>
        <select value={courseId} onChange={e => setCourseId(e.target.value)}>
          <option value="">No course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className="flex justify-end">
        <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(e => !e)}>{editing ? 'Preview' : 'Edit text'}</button>
      </div>
      {editing
        ? <textarea aria-label="Note text" className="h-64 w-full rounded-xl border border-line bg-transparent p-3 font-mono text-sm" value={text} onChange={e => setText(e.target.value)} />
        : (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-line px-3 py-2" aria-label="Preview">
            <MarkdownView source={text || '*Nothing was read from these pages.*'} />
          </div>
        )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-between gap-2">
        <button type="button" className="btn" onClick={onScanAgain}>↺ Scan again</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
      </div>
    </div>
  )
}
