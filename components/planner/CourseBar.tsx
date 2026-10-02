'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { COURSE_COLORS } from '@/lib/colors'
import { createCourse, deleteCourse, updateCourse } from '@/lib/data/courses'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/providers/ToastProvider'
import type { Course } from '@/lib/types'

export function CourseBar({ courses, selected, onSelect, onChange }: {
  courses: Course[]; selected: string | null; onSelect: (id: string | null) => void; onChange: (c: Course[]) => void
}) {
  const toast = useToast()
  const [editing, setEditing] = useState<Course | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Course | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COURSE_COLORS[0])

  function openNew() { setName(''); setColor(COURSE_COLORS[courses.length % COURSE_COLORS.length]); setEditing('new') }
  function openEdit(c: Course) { setName(c.name); setColor(c.color); setEditing(c) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      if (editing === 'new') {
        const c = await createCourse(supabase(), { name: name.trim(), color })
        onChange([...courses, c])
      } else if (editing) {
        await updateCourse(supabase(), editing.id, { name: name.trim(), color })
        onChange(courses.map(c => (c.id === editing.id ? { ...c, name: name.trim(), color } : c)))
      }
      setEditing(null)
    } catch { toast('Couldn\'t save.') }
  }

  async function remove(deleteContents: boolean) {
    if (!deleting) return
    try {
      await deleteCourse(supabase(), deleting.id, { deleteContents })
      onChange(courses.filter(c => c.id !== deleting.id))
      if (selected === deleting.id) onSelect(null)
      setDeleting(null); setEditing(null)
    } catch { toast('Couldn\'t delete the course.') }
  }

  // Course filters: a coloured square + name; the active one gets a tinted background in its colour
  const chip = (active: boolean) => `inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition ${active ? 'border-transparent font-medium' : 'border-line bg-raised hover:bg-surface'}`
  const tint = (color: string, active: boolean) => (active ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, color } : undefined)

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button className={chip(selected === null)} style={tint('var(--accent)', selected === null)} onClick={() => onSelect(null)}>All</button>
      {courses.map(c => (
        <button key={c.id} className={chip(selected === c.id)} style={tint(c.color, selected === c.id)} onClick={() => onSelect(c.id)}
          onDoubleClick={() => openEdit(c)} onContextMenu={e => { e.preventDefault(); openEdit(c) }}
          title="Double-click to edit">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: c.color }} />{c.name}
        </button>
      ))}
      <button className="btn-ghost" onClick={openNew}><Plus size={14} aria-hidden />Course</button>
      {selected && <button className="btn-ghost" onClick={() => openEdit(courses.find(c => c.id === selected)!)}>Edit</button>}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New course' : 'Edit course'}>
        <form onSubmit={save} className="space-y-3">
          <label className="field"><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Biology" /></label>
          <div className="flex gap-2" role="radiogroup" aria-label="Color">
            {COURSE_COLORS.map(c => (
              <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                className={`size-6 rounded-full ${color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`} style={{ background: c }} />
            ))}
          </div>
          <div className="flex justify-between gap-2 pt-2">
            {editing && editing !== 'new'
              ? <button type="button" className="btn text-danger" onClick={() => setDeleting(editing)}>Delete</button>
              : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary">Save</button>
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name ?? 'course'}?`}>
        <p className="mb-4 text-sm text-muted">Its classes will be removed. What should happen to its tasks, decks and notes?</p>
        <div className="flex flex-col gap-2">
          <button className="btn" onClick={() => remove(false)}>Keep them (no course)</button>
          <button className="btn text-danger" onClick={() => remove(true)}>Delete its tasks, decks and notes</button>
          <button className="btn-ghost justify-center" onClick={() => setDeleting(null)}>Cancel</button>
        </div>
      </Dialog>
    </div>
  )
}
