'use client'
import { useState } from 'react'
import { FolderInput, FolderPlus } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import type { Course, Notebook } from '@/lib/types'
import { Dropdown, courseOptions } from '@/components/ui/Dropdown'

// Make or rename a notebook, and choose the course it belongs to (it takes that course's colour)
export function NotebookNameDialog({ open, onClose, title, submitLabel, initial = '', courses = [], initialCourse = null, onSubmit }: {
  open: boolean; onClose: () => void; title: string; submitLabel: string; initial?: string
  courses?: Pick<Course, 'id' | 'name'>[]; initialCourse?: string | null
  onSubmit: (name: string, courseId: string | null) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} icon={FolderPlus}>
      {open && <NameForm onClose={onClose} submitLabel={submitLabel} initial={initial} courses={courses} initialCourse={initialCourse} onSubmit={onSubmit} />}
    </Dialog>
  )
}
function NameForm({ onClose, submitLabel, initial, courses, initialCourse, onSubmit }: {
  onClose: () => void; submitLabel: string; initial: string; courses: Pick<Course, 'id' | 'name'>[]; initialCourse: string | null; onSubmit: (name: string, courseId: string | null) => void
}) {
  const [name, setName] = useState(initial)
  const [course, setCourse] = useState(initialCourse && courses.some(c => c.id === initialCourse) ? initialCourse : '')
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (name.trim()) onSubmit(name.trim(), course || null) }}>
      <label className="field"><span>Name</span><input autoFocus value={name} maxLength={80} placeholder="Biology year 1" onChange={e => setName(e.target.value)} /></label>
      {courses.length > 0 && (
        <div className="field"><span>Course</span>
          <Dropdown label="Course" value={course} onChange={setCourse} options={courseOptions(courses)} />
        </div>
      )}
      <DialogFooter>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button className={BTN_SOLID} disabled={!name.trim()}>{submitLabel}</button>
      </DialogFooter>
    </form>
  )
}

// Choose the notebook for the notes: one of the student's, none, or a new one made on the spot
export function MoveToNotebookDialog({ open, onClose, notebooks, onMove, onCreateAndMove }: {
  open: boolean; onClose: () => void; notebooks: Notebook[]; onMove: (notebookId: string | null) => void; onCreateAndMove: (name: string) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Move to notebook" icon={FolderInput} subtitle="A note can be in one notebook at a time.">
      {open && <MoveBody notebooks={notebooks} onMove={onMove} onCreateAndMove={onCreateAndMove} />}
    </Dialog>
  )
}
function MoveBody({ notebooks, onMove, onCreateAndMove }: { notebooks: Notebook[]; onMove: (id: string | null) => void; onCreateAndMove: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="space-y-4">
      <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-raised text-sm" aria-label="Notebooks">
        {notebooks.map(b => (
          <li key={b.id}><button type="button" className="w-full px-3 py-2.5 text-left transition hover:bg-surface" onClick={() => onMove(b.id)}>{b.name}</button></li>
        ))}
        <li><button type="button" className="w-full px-3 py-2.5 text-left text-muted transition hover:bg-surface" onClick={() => onMove(null)}>No notebook</button></li>
      </ul>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (name.trim()) onCreateAndMove(name.trim()) }}>
        <label className="field min-w-0 flex-1"><span className="sr-only">New notebook</span><input aria-label="New notebook" value={name} maxLength={80} placeholder="Or start a new notebook" onChange={e => setName(e.target.value)} /></label>
        <button className={BTN_SOLID} disabled={!name.trim()}>Create and move</button>
      </form>
    </div>
  )
}
