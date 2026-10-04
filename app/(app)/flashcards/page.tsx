'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Layers, ScanLine } from 'lucide-react'
import { ScanDialog } from '@/components/scan/ScanDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dialog } from '@/components/ui/Dialog'
import { CourseTag } from '@/components/ui/CourseTag'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createDeck, listDecksWithDue } from '@/lib/data/decks'
import { listCourses } from '@/lib/data/courses'
import type { Course, DeckWithDue } from '@/lib/types'

export default function FlashcardsPage() {
  const toast = useToast()
  const [decks, setDecks] = useState<DeckWithDue[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [name, setName] = useState('')
  const [courseId, setCourseId] = useState('')

  useEffect(() => {
    const sb = supabase()
    Promise.all([listDecksWithDue(sb, new Date()), listCourses(sb)]).then(([d, c]) => { setDecks(d); setCourses(c) })
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const d = await createDeck(supabase(), { name: name.trim(), course_id: courseId || null })
      setDecks(ds => [...(ds ?? []), { ...d, due: 0, total: 0 }])
      setOpen(false); setName(''); setCourseId('')
    } catch { toast('Couldn\'t save.') }
  }

  const totalDue = decks?.reduce((n, d) => n + d.due, 0) ?? 0
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  return (
    <div>
      <PageHeader title="Flashcards" actions={<>
        {totalDue > 0 && <Link href="/review" className="btn-primary">Review all ({totalDue})</Link>}
        <button className="btn" onClick={() => setScanning(true)}><ScanLine size={14} aria-hidden />Scan</button>
        <button className="btn" onClick={() => setOpen(true)}><Plus size={14} aria-hidden />Deck</button>
      </>} />
      {decks?.length === 0 && (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Layers size={22} aria-hidden /></span>
          <p className="max-w-xs text-sm text-muted">Group cards into decks, one per topic. Reviews are scheduled so you remember for longer.</p>
          <button className="btn-primary" onClick={() => setOpen(true)}>Create a deck</button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks?.map(d => {
          const c = courseOf(d.course_id)
          const color = c?.color ?? 'var(--accent-solid)'
          return (
            <Link key={d.id} href={`/flashcards/${d.id}`} className="tile group relative overflow-hidden transition hover:-translate-y-0.5">
              {/* stacked-cards motif in the course colour */}
              <span aria-hidden className="absolute -right-3 -top-3 size-16 rotate-12 rounded-xl opacity-15" style={{ background: color }} />
              <span aria-hidden className="absolute -right-1 top-1 size-12 rotate-6 rounded-xl opacity-25" style={{ background: color }} />
              <div className="relative">
                <div className="font-semibold">{d.name}</div>
                <CourseTag course={c} className="mt-0.5" />
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-semibold" style={{ color: d.due > 0 ? color : undefined }}>{d.due}</div>
                    <div className="text-xs text-muted">{d.due > 0 ? 'due now' : 'all caught up'}</div>
                  </div>
                  <div className="text-xs text-muted">{d.total} cards</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="New deck">
        <form onSubmit={create} className="space-y-3">
          <label className="field"><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Cell biology" /></label>
          <label className="field"><span>Course</span>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Create</button></div>
        </form>
      </Dialog>
      <ScanDialog open={scanning} onClose={() => setScanning(false)} initialTarget="cards"
        onSaved={() => { listDecksWithDue(supabase(), new Date()).then(setDecks).catch(() => {}) }} />
    </div>
  )
}
