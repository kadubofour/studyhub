'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { fromZonedTime } from 'date-fns-tz'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { addDaysToKey, localDayKey, localTimeHHMM } from '@/lib/dates'
import { REPEATS, type MyReminder, type Repeat } from '@/lib/reminders/mine'
import type { ReminderInput } from '@/lib/data/reminders'

// A new reminder starts today at the next whole hour (just after 23:00, that is midnight tomorrow)
export function freshReminder(now: Date, tz: string): ReminderInput {
  const hour = Number(localTimeHHMM(now, tz).slice(0, 2)) + 1
  const today = localDayKey(now, tz)
  return hour === 24 ? { title: '', day: addDaysToKey(today, 1), at: '00:00', repeat: 'once' } : { title: '', day: today, at: `${String(hour).padStart(2, '0')}:00`, repeat: 'once' }
}

// Make or change a reminder: what, the day, the time, and how often
export function ReminderDialog({ editing, start, tz, onClose, onSave }: {
  /** The reminder being changed, or null for a new one */
  editing: MyReminder | null; start: ReminderInput | null; tz: string; onClose: () => void; onSave: (r: ReminderInput) => void
}) {
  const open = start !== null
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit reminder' : 'New reminder'} icon={Bell}>
      {open && <Form key={editing?.id ?? 'new'} start={start} tz={tz} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function Form({ start, tz, onClose, onSave }: { start: ReminderInput; tz: string; onClose: () => void; onSave: (r: ReminderInput) => void }) {
  const [r, setR] = useState(start)
  const [openedAt] = useState(() => Date.now()) // the moment the dialog opened: what "passed" is measured against
  const set = (patch: Partial<ReminderInput>) => setR(v => ({ ...v, ...patch }))
  // a one-off must be ahead; a repeating one simply starts on its next day
  const passed = r.repeat === 'once' && !!r.day && !!r.at && fromZonedTime(`${r.day}T${r.at}:00`, tz).getTime() < openedAt
  const ready = r.title.trim() !== '' && !!r.day && !!r.at && !passed
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (ready) onSave({ ...r, title: r.title.trim() }) }}>
      <label className="field"><span>What</span>
        <input autoFocus value={r.title} maxLength={120} placeholder="Email my tutor" onChange={e => set({ title: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field"><span>Date</span><input type="date" value={r.day} onChange={e => set({ day: e.target.value })} /></label>
        <label className="field"><span>Time</span><input type="time" value={r.at} onChange={e => set({ at: e.target.value })} /></label>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-muted">Repeat</span>
        <ChoiceChips label="Repeat" value={r.repeat} options={REPEATS} onChange={v => set({ repeat: v as Repeat })} />
      </div>
      {passed && <p role="alert" className="text-sm text-danger">That time has passed.</p>}
      <DialogFooter>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button className={BTN_SOLID} disabled={!ready}>Save</button>
      </DialogFooter>
    </form>
  )
}
