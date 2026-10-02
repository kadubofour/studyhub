'use client'
import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { PageHeader } from '@/components/ui/PageHeader'
import { AppearanceCard } from '@/components/settings/AppearanceCard'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { clearTimer } from '@/lib/ui/timerStore'
import { changedFields } from '@/lib/ui/changedFields'

import type { EditorMode, Profile, ThemePref } from '@/lib/types'

const noopSubscribe = () => () => {}

export default function SettingsPage() {
  const { profile, setProfile } = useProfile()
  const toast = useToast()
  const router = useRouter()
  const { setTheme } = useTheme()
  const [form, setForm] = useState(profile)
  // What the form started from: only fields that differ from this are saved
  const [initial, setInitial] = useState(profile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setForm(f => ({ ...f, [k]: v })); setError(null) }

  // The full zone list comes from the browser, so render it only after hydration (server lists can differ),
  // and always include the saved zone and UTC so the select never shows the wrong value.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const zones = mounted && typeof Intl.supportedValuesOf === 'function'
    ? [...new Set([form.timezone, 'UTC', ...Intl.supportedValuesOf('timeZone')])].sort()
    : [form.timezone]

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const ints: [keyof Profile, number, number][] = [
      ['daily_goal_minutes', 1, 1440], ['focus_minutes', 1, 180], ['short_break_minutes', 1, 60],
      ['long_break_minutes', 1, 120], ['long_break_every', 1, 12],
    ]
    for (const [k, min, max] of ints) {
      const v = form[k] as number
      if (!Number.isInteger(v) || v < min || v > max) { setError(`Enter a whole number from ${min} to ${max}.`); return }
    }
    setBusy(true)
    try {
      const patch = changedFields(initial, form) // id never changes, so it is never sent
      if (Object.keys(patch).length === 0) { toast('Settings saved'); return }
      const saved = await updateProfile(supabase(), profile.id, patch)
      setProfile(saved)
      setForm(saved)
      setInitial(saved)
      setTheme(saved.theme)
      toast('Settings saved')
    } catch { toast('Couldn\'t save.') } finally { setBusy(false) }
  }

  async function signOut() {
    // A shared device must not hand this student's running focus session to the next person
    clearTimer(window.localStorage, profile.id)
    await supabase().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const num = (k: keyof Profile, label: string) => (
    <label className="field"><span>{label}</span>
      <input type="number" inputMode="numeric" value={form[k] as number} onChange={e => set(k, Number(e.target.value) as never)} />
    </label>
  )

  return (
    <div className="max-w-xl space-y-5">
      <PageHeader title="Settings" />
      <AppearanceCard />
      <form onSubmit={save} className="card space-y-5">
      <h2 className="text-base font-semibold">Profile and focus</h2>
      <section className="space-y-3">
        <label className="field"><span>Name</span><input value={form.display_name ?? ''} onChange={e => set('display_name', e.target.value || null)} /></label>
        <label className="field"><span>Time zone</span>
          <select value={form.timezone} onChange={e => set('timezone', e.target.value)}>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
      </section>
      <section className="grid grid-cols-2 gap-3">
        {num('daily_goal_minutes', 'Daily focus goal (min)')}
        {num('focus_minutes', 'Focus length (min)')}
        {num('short_break_minutes', 'Short break (min)')}
        {num('long_break_minutes', 'Long break (min)')}
        {num('long_break_every', 'Long break every N sessions')}
      </section>
      <section className="grid grid-cols-2 gap-3">
        <label className="field"><span>Default note editor</span>
          <select value={form.default_editor_mode} onChange={e => set('default_editor_mode', e.target.value as EditorMode)}>
            <option value="rich">Rich</option><option value="markdown">Markdown</option>
          </select>
        </label>
        <label className="field"><span>Theme</span>
          <select value={form.theme} onChange={e => set('theme', e.target.value as ThemePref)}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
      </section>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-between">
        <button type="button" className="btn" onClick={signOut}>Sign out</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
      </form>
    </div>
  )
}
