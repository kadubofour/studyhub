'use client'
import { useId, useState, useSyncExternalStore } from 'react'
import { Switch } from '@/components/ui/Switch'
import { BTN_OUTLINE } from '@/components/ui/buttonStyles'
import { FocusAlerts } from '@/components/focus/FocusAlerts'
import { useReminders } from '@/components/providers/ReminderProvider'
import { askNotificationPermission, notificationPermission } from '@/lib/focus/alert'
import {
  CLASS_LEADS, DEFAULT_REMINDERS, EXAM_LEADS, TASK_LEADS, isHHMM, setReminderPrefs, useReminderPrefs, type ReminderPrefs,
} from '@/lib/reminders/prefs'

const words = (m: number) => (m === 0 ? 'At the time' : m % 1440 === 0 ? `${m / 1440} ${m === 1440 ? 'day' : 'days'} before` : m % 60 === 0 ? `${m / 60} ${m === 60 ? 'hour' : 'hours'} before` : `${m} minutes before`)

type LeadKey = 'taskLead' | 'examLead' | 'classLead'
type TimeKey = 'cards' | 'goal' | 'morning'

// One reminder: a switch, and once it is on, when
function Row({ title, hint, on, onToggle, children }: { title: string; hint: string; on: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode }) {
  const id = useId()
  return (
    <li className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p id={id} className="text-sm">{title}</p>
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
        {on && children && <div className="mt-2">{children}</div>}
      </div>
      <Switch checked={on} onChange={onToggle} labelledBy={id} describedBy={`${id}-hint`} />
    </li>
  )
}

function LeadRow({ k, title, hint, options, prefs }: { k: LeadKey; title: string; hint: string; options: readonly number[]; prefs: ReminderPrefs }) {
  const v = prefs[k]
  return (
    <Row title={title} hint={hint} on={v !== null} onToggle={on => setReminderPrefs({ [k]: on ? DEFAULT_REMINDERS[k] : null })}>
      <select aria-label={`${title}: when`} value={v ?? ''} onChange={e => setReminderPrefs({ [k]: Number(e.target.value) })}>
        {options.map(m => <option key={m} value={m}>{words(m)}</option>)}
      </select>
    </Row>
  )
}

function TimeRow({ k, title, hint, prefs }: { k: TimeKey; title: string; hint: string; prefs: ReminderPrefs }) {
  const v = prefs[k]
  return (
    <Row title={title} hint={hint} on={v !== null} onToggle={on => setReminderPrefs({ [k]: on ? DEFAULT_REMINDERS[k] : null })}>
      <input type="time" aria-label={`${title}: time of day`} value={v ?? ''} onChange={e => { if (isHHMM(e.target.value)) setReminderPrefs({ [k]: e.target.value }) }} />
    </Row>
  )
}

export function RemindersCard() {
  const prefs = useReminderPrefs()
  const { test } = useReminders()
  const masterId = useId()
  const [note, setNote] = useState<string | null>(null)
  // Only the browser knows whether notifications are blocked, so the page says so after it has loaded
  const blocked = useSyncExternalStore(() => () => {}, () => notificationPermission() === 'denied' || notificationPermission() === 'unsupported', () => false)

  async function setOn(on: boolean) {
    setReminderPrefs({ on })
    setNote(null)
    if (!on) return
    const answer = await askNotificationPermission() // reminders still work inside Studyhub if the student says no
    if (answer !== 'granted') setNote(answer === 'unsupported' ? 'This browser cannot show notifications, so reminders appear inside Studyhub.' : answer === 'default' ? 'Allow notifications when your browser asks to get reminders on other tabs. Until then they appear inside Studyhub.' : 'Notifications are blocked for this site, so reminders appear inside Studyhub. Allow them in your browser\'s settings to get them on other tabs.')
  }

  const quiet = prefs.quiet
  return (
    <div className="space-y-4">
      <section aria-label="Reminders" className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p id={masterId} className="text-sm font-medium">Remind me</p>
            <p id={`${masterId}-hint`} className="text-xs text-muted">
              Reminders appear while Studyhub is open in a tab or window{blocked ? ', inside the page' : ', and as a notification when you are on another tab'}. Closed, they cannot reach you yet.
            </p>
          </div>
          <Switch checked={prefs.on} onChange={v => void setOn(v)} labelledBy={masterId} describedBy={`${masterId}-hint`} />
        </div>
        {note && <p role="alert" className="mt-2 text-xs text-danger">{note}</p>}
        {prefs.on && <button type="button" className={`${BTN_OUTLINE} mt-3`} onClick={test}>Send a test reminder</button>}
      </section>

      {prefs.on && (
        <>
          <section aria-label="What to remind me about" className="card">
            <h3 className="mb-3 text-sm font-medium">What to remind me about</h3>
            <ul className="divide-y divide-line">
              <LeadRow k="taskLead" title="Tasks due" hint="Assignments, readings and anything with a due time." options={TASK_LEADS} prefs={prefs} />
              <LeadRow k="examLead" title="Exams coming up" hint="An extra, earlier reminder for exams." options={EXAM_LEADS} prefs={prefs} />
              <LeadRow k="classLead" title="Classes starting" hint="Lectures, labs and tutorials on your timetable." options={CLASS_LEADS} prefs={prefs} />
              <TimeRow k="cards" title="Flashcards to review" hint="Once a day, only when cards are due." prefs={prefs} />
              <TimeRow k="goal" title="Daily focus goal" hint="Once a day, only if you are still short of your goal." prefs={prefs} />
              <TimeRow k="morning" title="Today's plan" hint="A morning summary of what is due and which classes are on." prefs={prefs} />
            </ul>
          </section>

          <section aria-label="Quiet hours" className="card">
            <ul>
              <Row title="Quiet hours" hint="No reminders at night. The focus timer still tells you when time is up." on={quiet !== null}
                onToggle={on => setReminderPrefs({ quiet: on ? DEFAULT_REMINDERS.quiet : null })}>
                {quiet && (
                  <div className="flex items-center gap-2 text-sm">
                    <input type="time" aria-label="Quiet hours start" value={quiet.from} onChange={e => { if (isHHMM(e.target.value)) setReminderPrefs({ quiet: { ...quiet, from: e.target.value } }) }} />
                    <span className="text-muted">to</span>
                    <input type="time" aria-label="Quiet hours end" value={quiet.to} onChange={e => { if (isHHMM(e.target.value)) setReminderPrefs({ quiet: { ...quiet, to: e.target.value } }) }} />
                  </div>
                )}
              </Row>
            </ul>
          </section>
        </>
      )}

      <FocusAlerts />
    </div>
  )
}
