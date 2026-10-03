'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { RichEditor, insertTable } from '@/components/notes/RichEditor'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { NoteMenuBar, type NoteMenuActions } from '@/components/notes/NoteMenuBar'
import { StudyPanel } from '@/components/notes/study/StudyPanel'
import { FindBar } from '@/components/notes/FindBar'
import { EquationDialog, type EquationInit } from '@/components/notes/EquationDialog'
import { ImportDialog } from '@/components/notes/ImportDialog'
import { findMatches, findKey, wrap, highlightInElement, clearElementHighlights } from '@/components/notes/findInNote'
import type { EditMath } from '@/components/notes/extensions'
import { autoWrapMath } from '@/components/notes/autoMath'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { updateProfile } from '@/lib/data/profile'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote, deleteNote, getNote, updateNote } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import { exportNotesToWord, openPdfExport } from '@/lib/export/exportNotes'
import { useAutosave } from '@/lib/ui/useAutosave'
import { shouldLeaveOnEscape } from '@/lib/ui/escapeToLeave'
import { NOTES_CHANGED } from '@/components/notes/NotesSidebar'
import type { Course, EditorMode, Note } from '@/lib/types'

const notifyList = () => { window.dispatchEvent(new Event(NOTES_CHANGED)) }

type Patch = Partial<Pick<Note, 'title' | 'content_md' | 'course_id'>>
const STATUS_TEXT = {
  idle: '', pending: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved — will retry',
  failed: 'Couldn\'t save this change. Check the course still exists, then edit again.',
} as const

// A Markdown table with `rows` rows (the first is the header) and `cols` columns
function markdownTable(rows: number, cols: number) {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |\n`
  const blank = Array<string>(cols).fill('  ')
  return line(Array.from({ length: cols }, (_, i) => `Column ${i + 1}`)) + line(Array<string>(cols).fill('---'))
    + Array.from({ length: Math.max(1, rows - 1) }, () => line(blank)).join('')
}

// An equation being written (pos undefined) or edited (pos of its node in the rich editor)
type EquationEdit = { initial: EquationInit; pos?: number; seq: number }

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  // Keyed: switching notes remounts the editor, so its autosaver always targets this note
  return <NoteEditor key={id} id={id} />
}

function NoteEditor({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const { profile, setProfile } = useProfile()
  const confirm = useConfirm()
  const [note, setNote] = useState<Note | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [mode, setMode] = useState<EditorMode>(profile.default_editor_mode)
  const [reading, setReading] = useState(false)
  const [fullWidth, setFullWidth] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [studyOpen, setStudyOpen] = useState(false)
  const [equation, setEquation] = useState<EquationEdit | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [draft, setDraft] = useState<Note | null>(null)
  // Ref holds the latest draft: the Tiptap onUpdate callback is created once, so reading
  // `draft` state from it would merge onto a stale copy and drop title/course edits.
  const draftRef = useRef<Note | null>(null)
  const markdownRef = useRef<HTMLTextAreaElement>(null)
  const renderedRef = useRef<HTMLDivElement>(null) // Markdown preview or reading view
  const { update, status, flush } = useAutosave<Patch>(patch => updateNote(supabase(), id, patch).then(notifyList))

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

  // Change the whole note text from outside the editor (e.g. adding a summary). `update` gets the
  // text as it is right now, so edits made while an AI call ran aren't lost. In the rich editor this
  // goes through Tiptap, so the change shows, autosaves via onUpdate and can be undone.
  function applyContent(update: (current: string) => string) {
    if (mode === 'rich' && !reading && editor && !editor.isDestroyed) {
      editor.commands.setContent(update(editor.getMarkdown()), { contentType: 'markdown', emitUpdate: true })
    } else if (draftRef.current) {
      change({ content_md: update(draftRef.current.content_md) })
    }
  }

  async function remove() {
    const ok = await confirm({
      title: 'Delete this note?', body: `“${draftRef.current?.title || 'Untitled'}” will be deleted. This can't be undone.`,
      confirmLabel: 'Delete note', danger: true,
    })
    if (!ok) return
    try { await deleteNote(supabase(), id); notifyList(); router.replace('/notes') } catch { toast('Couldn\'t delete the note.') }
  }

  // Esc leaves the full-screen editor (menus, find and dialogs handle their own Esc first)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const fromEditor = !!(e.target as HTMLElement | null)?.closest?.('.ProseMirror')
      if (!shouldLeaveOnEscape(e, !!document.querySelector('dialog[open]'), fromEditor)) return
      router.replace('/notes') // replace: Back shouldn't reopen the note we just left
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  // Ctrl/⌘+F finds in this note rather than the whole page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); setFindOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Clicking an equation in the rich editor opens it for editing (setters only: read once by Tiptap)
  const editMath = useCallback<EditMath>((kind, latex, pos) => {
    setEquation(e => ({ initial: { latex, display: kind === 'block' }, pos, seq: (e?.seq ?? 0) + 1 }))
  }, [])

  function closeFind() {
    setFindOpen(false)
    clearElementHighlights()
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(findKey, { query: '', index: 0 }))
  }

  // Switching views changes what text is being searched, so start the search over
  function changeView(fn: () => void) { if (findOpen) closeFind(); fn() }

  function search(query: string, index: number): number {
    if (!reading && mode === 'rich' && editor) {
      const matches = findMatches(editor.state.doc, query)
      const k = wrap(index, matches.length)
      let tr = editor.state.tr.setMeta(findKey, { query, index: k })
      if (matches.length) tr = tr.setSelection(TextSelection.create(tr.doc, matches[k].from, matches[k].to)).scrollIntoView()
      editor.view.dispatch(tr)
      return matches.length
    }
    // Reading mode, or the Markdown editor's preview
    return highlightInElement(renderedRef.current, query, index)
  }

  // Replace the Markdown editor's selection with `text` and put the cursor after it
  function insertMarkdown(text: string) {
    const ta = markdownRef.current
    const cur = draftRef.current?.content_md ?? ''
    const start = ta?.selectionStart ?? cur.length
    const end = ta?.selectionEnd ?? cur.length
    change({ content_md: cur.slice(0, start) + text + cur.slice(end) })
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(start + text.length, start + text.length) })
  }

  function saveEquation(latex: string, display: boolean) {
    if (mode === 'markdown') {
      insertMarkdown(display ? `\n\n$$\n${latex}\n$$\n\n` : `$${latex}$`)
      return
    }
    if (!editor) return
    const pos = equation?.pos
    const node = pos === undefined ? null : editor.state.doc.nodeAt(pos)
    if (pos === undefined || !node) {
      if (display) editor.chain().focus().insertBlockMath({ latex }).run()
      else editor.chain().focus().insertInlineMath({ latex }).run()
    } else if ((node.type.name === 'blockMath') === display) {
      if (display) editor.chain().focus().updateBlockMath({ latex, pos }).run()
      else editor.chain().focus().updateInlineMath({ latex, pos }).run()
    } else {
      // Switched between inline and its own line: swap the node
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize })
        .insertContentAt(pos, { type: display ? 'blockMath' : 'inlineMath', attrs: { latex } }).run()
    }
  }

  const actions: NoteMenuActions = {
    newNote: async () => {
      try {
        const n = await createNote(supabase(), { course_id: draftRef.current?.course_id ?? null })
        notifyList(); router.push(`/notes/${n.id}`)
      } catch { toast('Couldn\'t create a note.') }
    },
    importNote: () => setImportOpen(true),
    exportWord: async () => {
      try { if (!await exportNotesToWord([id])) toast('There is nothing to export.') } catch { toast('Couldn\'t create the Word document.') }
    },
    exportPdf: () => openPdfExport([id]),
    deleteNote: remove,
    undo: () => {
      if (mode === 'rich') editor?.chain().focus().undo().run()
      else { markdownRef.current?.focus(); document.execCommand('undo') }
    },
    redo: () => {
      if (mode === 'rich') editor?.chain().focus().redo().run()
      else { markdownRef.current?.focus(); document.execCommand('redo') }
    },
    selectAll: () => {
      if (reading) { if (renderedRef.current) window.getSelection()?.selectAllChildren(renderedRef.current) }
      else if (mode === 'rich') editor?.chain().focus().selectAll().run()
      else { markdownRef.current?.focus(); markdownRef.current?.select() }
    },
    find: () => setFindOpen(true),
    insertTable: (rows, cols) => {
      if (mode === 'rich') { if (editor) insertTable(editor, rows, cols) } else insertMarkdown(`\n\n${markdownTable(rows, cols)}\n`)
    },
    insertEquation: () => setEquation(e => ({ initial: null, seq: (e?.seq ?? 0) + 1 })),
    setMode: m => changeView(() => { setMode(m); setReading(false) }),
    toggleReading: () => changeView(() => setReading(r => !r)),
    toggleFullWidth: () => setFullWidth(w => !w),
    // Same switch as Settings > Turn typed maths into equations
    toggleAutoMath: async () => {
      const on = !profile.auto_math
      setProfile(p => ({ ...p, auto_math: on }))
      try {
        await updateProfile(supabase(), profile.id, { auto_math: on })
        toast(on ? 'Automatic maths is on' : 'Automatic maths is off — use $…$ for equations')
      } catch {
        setProfile(p => ({ ...p, auto_math: !on }))
        toast('Couldn\'t change that setting.')
      }
    },
  }

  if (!note || !draft) return null

  const width = fullWidth ? 'max-w-none' : reading || mode === 'rich' ? 'max-w-3xl' : 'max-w-6xl'

  return (
    <div className={`min-h-dvh ${studyOpen ? 'md:pr-[380px]' : ''}`}>
      <header className="no-print sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur md:px-6">
        <Link href="/notes" className="btn-ghost" aria-label="Back to notes" title="Back to notes (Esc)"><ArrowLeft size={17} aria-hidden /></Link>
        <NoteMenuBar actions={actions} mode={mode} reading={reading} fullWidth={fullWidth} autoMath={profile.auto_math} />
        <select className="input max-w-44" value={draft.course_id ?? ''} onChange={e => change({ course_id: e.target.value || null })} aria-label="Course">
          <option value="">No course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {reading && <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-xs text-accent">Reading</span>}
        <span className={`text-xs ${status === 'failed' ? 'text-danger' : 'text-muted'}`} aria-live="polite">{STATUS_TEXT[status]}</span>
        <button type="button" className={`btn ml-auto ${studyOpen ? 'bg-accent-soft text-accent' : ''}`} aria-expanded={studyOpen} onClick={() => setStudyOpen(o => !o)}>✦ Study</button>
        {findOpen && <div><FindBar search={search} onClose={closeFind} /></div>}
      </header>
      <div className={`mx-auto px-5 pb-24 pt-8 md:px-8 ${width}`}>
        {reading ? (
          <article>
            <h1 className="mb-4 text-3xl font-semibold">{draft.title || 'Untitled'}</h1>
            <div ref={renderedRef}><MarkdownView source={draft.content_md || '*This note is empty.*'} /></div>
          </article>
        ) : (
          <>
            <input className="mb-1 w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-muted" value={draft.title} placeholder="Untitled"
              onChange={e => change({ title: e.target.value })} aria-label="Title" />
            {mode === 'rich' ? (
              <RichEditor key={`rich-${note.id}`} markdown={draft.content_md} onChange={md => change({ content_md: md })}
                onReady={setEditor} onEditMath={editMath} onInsertEquation={actions.insertEquation} autoMath={profile.auto_math} />
            ) : (
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <textarea ref={markdownRef} className="input min-h-[70vh] font-mono text-[13px]" value={draft.content_md} aria-label="Markdown"
                  onChange={e => {
                    // Typing a space after maths like x^2 wraps it in $…$
                    const typedSpace = (e.nativeEvent as InputEvent).inputType === 'insertText' && (e.nativeEvent as InputEvent).data === ' '
                    const wrapped = typedSpace && profile.auto_math ? autoWrapMath(e.target.value, e.target.selectionStart) : null
                    change({ content_md: wrapped?.value ?? e.target.value })
                    if (wrapped) { const ta = e.target; requestAnimationFrame(() => ta.setSelectionRange(wrapped.cursor, wrapped.cursor)) }
                  }} />
                <div ref={renderedRef} className="min-h-[70vh] border-t border-line pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <MarkdownView source={draft.content_md} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {studyOpen && <StudyPanel note={draft} onClose={() => setStudyOpen(false)} prepare={flush} applyContent={applyContent} />}
      {equation && (
        <EquationDialog key={equation.seq} open initial={equation.initial} onClose={() => setEquation(null)} onSave={saveEquation} />
      )}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} courses={courses} onImported={notifyList} />
    </div>
  )
}
