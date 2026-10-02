'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { PageHeader } from '@/components/ui/PageHeader'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import { clearTimer } from '@/lib/ui/timerStore'
import type { EditorMode, Profile, ThemePref } from '@/lib/types'

export default function SettingsPage() {
  const { profile, setProfile } = useProfile()
  const toast = useToast()
  const router = useRouter()
  const { setTheme } = useTheme()
  const [form, setForm] = useState(profile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setForm(f => ({ ...f, [k]: v })); setError(null) }

  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [profile.timezone]

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
      const { id, ...patch } = form
      const saved = await updateProfile(supabase(), id, patch)
      setProfile(saved)
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
    <form onSubmit={save} className="max-w-md space-y-5">
      <PageHeader title="Settings" />
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
  )
}
