'use client'
import { useState, useSyncExternalStore } from 'react'
import { BellRing } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import { askNotificationPermission, chime, notificationPermission } from '@/lib/focus/alert'
import { setFocusPrefs, useFocusPrefs } from '@/lib/focus/prefs'

// What happens when time is up: the chime and vibration, a browser notification, and whether the next session starts by itself
export function FocusAlerts() {
  const prefs = useFocusPrefs()
  const [note, setNote] = useState<string | null>(null)
  // Only the browser knows whether notifications are blocked, so the page says so after it has loaded, not while it is built on the server
  const blocked = useSyncExternalStore(() => () => {}, () => notificationPermission() === 'denied', () => false)

  async function setNotify(on: boolean) {
    setNote(null)
    if (!on) { setFocusPrefs({ notify: false }); return }
    const answer = await askNotificationPermission()
    if (answer === 'granted') setFocusPrefs({ notify: true })
    else {
      setFocusPrefs({ notify: false })
      setNote(answer === 'unsupported' ? 'This browser cannot show notifications.' : 'Notifications are blocked for this site. Allow them in your browser\'s settings, then try again.')
    }
  }

  const rows = [
    { id: 'alert-sound', label: 'Sound and vibration', hint: 'A short chime when time is up', checked: prefs.sound, onChange: (v: boolean) => { setFocusPrefs({ sound: v }); if (v) chime(0.25) } },
    { id: 'alert-notify', label: 'Notification', hint: blocked ? 'Blocked in this browser' : 'Tells you when you are on another tab or app', checked: prefs.notify, onChange: (v: boolean) => void setNotify(v) },
    { id: 'alert-awake', label: 'Keep the screen on during a session', hint: 'So the phone does not go to sleep while you focus', checked: prefs.keepAwake, onChange: (v: boolean) => setFocusPrefs({ keepAwake: v }) },
    { id: 'alert-auto', label: 'Start the next one automatically', hint: 'A finished session rolls into its break, and a break into the next session', checked: prefs.autoStart, onChange: (v: boolean) => setFocusPrefs({ autoStart: v }) },
  ]

  return (
    <section aria-label="When time is up" className="card mx-auto mt-6 text-left">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><BellRing size={16} className="text-muted" aria-hidden />When time is up</h2>
      <ul className="divide-y divide-line">
        {rows.map(r => (
          <li key={r.id} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p id={r.id} className="text-sm">{r.label}</p>
              <p id={`${r.id}-hint`} className="text-xs text-muted">{r.hint}</p>
            </div>
            <Switch checked={r.checked} onChange={r.onChange} labelledBy={r.id} describedBy={`${r.id}-hint`} />
          </li>
        ))}
      </ul>
      {note && <p role="alert" className="mt-2 text-xs text-danger">{note}</p>}
    </section>
  )
}
