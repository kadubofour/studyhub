'use client'
import { useState } from 'react'
import { TimeGrid } from './TimeGrid'
import { CAL_BTN } from './buttons'
import { ClassDialog } from '@/components/planner/ClassDialog'
import { localDayKey, weekKeysFor } from '@/lib/dates'
import type { ClassSlot, Course } from '@/lib/types'

// The weekly timetable: the classes that repeat every week, with no dates. Click an empty hour or Add class to add one; click a class to change it.
export function TimetableView({ classes, courses, tz, onSaveClass, onDeleteClass }: {
  classes: ClassSlot[]; courses: Course[]; tz: string
  onSaveClass: (input: Omit<ClassSlot, 'id'>, id?: string) => void; onDeleteClass: (id: string) => void
}) {
  const [now] = useState(() => new Date())
  const todayKey = localDayKey(now, tz)
  const [dialog, setDialog] = useState<Partial<ClassSlot> | null>(null)
  const pad = (n: number) => String(n).padStart(2, '0')
  const noCourse = courses.length === 0

  return (
    <div>
      {noCourse
        ? <p className="mb-3 text-sm text-muted">Add a course first, then add its classes here.</p>
        : <button type="button" className={`${CAL_BTN} mb-3`} onClick={() => setDialog({})}>Add class</button>}
      <TimeGrid keys={weekKeysFor(todayKey)} todayKey={todayKey} now={now} tz={tz} classes={classes} courses={courses} itemsByDay={{}}
        showStrip={false} showNow={false}
        onClassClick={c => { if (!c.id.startsWith('temp-')) setDialog(c) }} onItemClick={() => {}}
        onSlotClick={(k, h) => {
          if (noCourse) return
          const dow = new Date(`${k}T12:00:00Z`).getUTCDay()
          setDialog({ day_of_week: dow, start_time: `${pad(h)}:00`, end_time: h >= 23 ? '23:59' : `${pad(h + 1)}:00` })
        }} />
      <ClassDialog open={dialog !== null} initial={dialog} courses={courses} onClose={() => setDialog(null)}
        onSave={input => { const id = dialog?.id; setDialog(null); onSaveClass(input, id) }}
        onDelete={dialog?.id ? () => { const id = dialog.id!; setDialog(null); onDeleteClass(id) } : undefined} />
    </div>
  )
}
