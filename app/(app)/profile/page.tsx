'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Flame, Layers, Lock, MessagesSquare, Mic, NotebookPen, Pencil, ListChecks, Gamepad2, Star, Timer, type LucideIcon } from 'lucide-react'
import { Avatar } from '@/components/profile/Avatar'
import { usePlan } from '@/components/billing/usePlan'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useXp } from '@/components/xp/useXp'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { getProfileStats, updateProfile } from '@/lib/data/profile'
import { AVATAR_COLORS } from '@/lib/profile/avatar'
import { earnedCount, evaluate, type BadgeState, type Stats } from '@/lib/profile/badges'
import type { Course } from '@/lib/types'

const ICON: Record<BadgeState['icon'], LucideIcon> = { note: NotebookPen, cards: Layers, mic: Mic, focus: Timer, quiz: ListChecks, game: Gamepad2, chat: MessagesSquare, flame: Flame, star: Star }
const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Who the student is, what they have done, and the badges they have earned
export default function ProfilePage() {
  const { profile, setProfile } = useProfile()
  const { xp } = useXp()
  const plan = usePlan()
  const [email, setEmail] = useState<string | null>(null)
  const [joined, setJoined] = useState<Date | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsFailed, setStatsFailed] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', school: '', programme: '', color: profile.avatar_color })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    let live = true
    const sb = supabase()
    sb.auth.getUser().then(({ data }) => { if (live && data.user) { setEmail(data.user.email ?? null); setJoined(data.user.created_at ? new Date(data.user.created_at) : null) } }).catch(() => {})
    getProfileStats(sb).then(s => { if (live) setStats(s) }).catch(() => { if (live) setStatsFailed(true) })
    listCourses(sb).then(c => { if (live) setCourses(c) }).catch(() => {})
    return () => { live = false }
  }, [])

  function startEditing() {
    setForm({ name: profile.display_name ?? '', school: profile.school ?? '', programme: profile.programme ?? '', color: profile.avatar_color })
    setError(null); setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (savingRef.current) return
    savingRef.current = true; setSaving(true); setError(null)
    // A cleared name keeps the old one; a cleared school or programme becomes nothing
    const name = form.name.trim()
    const patch = { ...(name ? { display_name: name } : {}), school: form.school.trim() || null, programme: form.programme.trim() || null, avatar_color: form.color }
    try {
      await updateProfile(supabase(), profile.id, patch)
      setProfile(p => ({ ...p, ...patch }))
      setEditing(false)
    } catch { setError('Could not save your profile. Try again.') }
    savingRef.current = false; setSaving(false)
  }

  const badges = stats && xp ? evaluate({ stats, bestStreak: xp.best, level: xp.level.level }) : stats ? evaluate({ stats, bestStreak: 0, level: 1 }) : null
  const sub = [profile.programme, profile.school].filter(Boolean).join(' · ')
  const tiles: [string, string, 'a' | 'b' | 'c'][] = stats && xp ? [
    ['Level', String(xp.level.level), 'c'], ['Streak', days(xp.streak), 'a'], ['Best streak', days(xp.best), 'b'], ['Focus time', fmtMinutes(stats.focus_minutes), 'c'],
    ['Notes', String(stats.notes), 'b'], ['Flashcards', String(stats.cards), 'a'], ['Lectures', String(stats.lectures), 'c'], ['Quizzes finished', String(stats.quizzes_done), 'b'],
  ] : []

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="card flex flex-wrap items-center gap-4" aria-labelledby="profile-name">
        <Avatar name={profile.display_name} email={email} color={profile.avatar_color} size={72} />
        <div className="min-w-0 flex-1">
          <h1 id="profile-name" className="truncate text-2xl font-semibold">{profile.display_name || 'Your profile'}</h1>
          {sub && <p className="text-sm">{sub}</p>}
          {email && <p className="text-sm text-muted">{email}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted">
            {joined && <span>Member since {joined.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>}
            {plan.billing && !plan.loading && <span className="font-medium text-accent">{plan.isPremium && plan.premiumUntil ? `Premium until ${longDate(plan.premiumUntil)}` : 'Free plan'}</span>}
          </p>
        </div>
        {!editing && <button type="button" className="btn" onClick={startEditing}><Pencil size={14} aria-hidden />Edit profile</button>}
      </section>

      {editing && (
        <form onSubmit={save} className="card space-y-3" aria-label="Edit profile">
          <label className="field"><span>Name</span><input value={form.name} maxLength={60} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field"><span>School</span><input value={form.school} maxLength={80} onChange={e => setForm({ ...form, school: e.target.value })} placeholder="University of Ghana" /></label>
          <label className="field"><span>Programme</span><input value={form.programme} maxLength={80} onChange={e => setForm({ ...form, programme: e.target.value })} placeholder="Biology" /></label>
          <div>
            <div className="mb-1.5 text-sm text-muted" id="avatar-colour">Avatar colour</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="avatar-colour" aria-label="Avatar colour">
              {AVATAR_COLORS.map(c => {
                const on = form.color.toLowerCase() === c.toLowerCase()
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} aria-label={c} onClick={() => setForm({ ...form, color: c })}
                    className={`flex size-9 items-center justify-center rounded-full text-white ${on ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`} style={{ background: c }}>
                    {on && <Check size={16} aria-hidden />}
                  </button>
                )
              })}
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => { setEditing(false); setError(null) }}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      <section aria-labelledby="totals-title" className="space-y-3">
        <h2 id="totals-title" className="text-base font-semibold">Your study so far</h2>
        {statsFailed && <p role="alert" className="text-sm text-danger">Could not load your study totals. Check your connection.</p>}
        {tiles.length > 0 && (
          <ul aria-label="Study totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map(([label, value, tone]) => (
              <li key={label} className={`tile tile-${tone}`}>
                <div className="tile-label">{label}</div>
                <div className="tile-value">{value}</div>
              </li>
            ))}
          </ul>
        )}
        {xp && (
          <div className="card">
            <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium">Level {xp.level.level}</span><span className="text-muted">{xp.total} XP in all</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Progress to level ${xp.level.level + 1}`} aria-valuenow={xp.level.into} aria-valuemin={0} aria-valuemax={xp.level.span} aria-valuetext={`${xp.level.into} of ${xp.level.span} XP`}>
              <div className="h-2.5 rounded-full bg-accent-solid" style={{ width: `${Math.round((xp.level.into / xp.level.span) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{xp.level.toNext} XP to level {xp.level.level + 1}</p>
          </div>
        )}
      </section>

      {badges && (
        <section aria-labelledby="badges-title" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="badges-title" className="text-base font-semibold">Badges</h2>
            <span className="text-sm text-muted">{earnedCount(badges)} of {badges.length} badges earned</span>
          </div>
          <ul aria-label="Badges" className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {badges.map(b => {
              const Icon = ICON[b.icon]
              return (
                <li key={b.id} className={`card flex items-start gap-3 py-3 ${b.earned ? 'tile-c' : ''}`}>
                  <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full ${b.earned ? 'bg-accent-solid text-white' : 'bg-surface text-muted'}`}>{b.earned ? <Icon size={18} /> : <Lock size={16} />}</span>
                  <div className="min-w-0">
                    <div className="font-medium">{b.label}</div>
                    <div className="text-xs text-muted">{b.how}</div>
                    <div className={`mt-1 text-xs font-medium ${b.earned ? 'text-success' : 'text-muted'}`}>{b.earned ? 'Earned' : `Locked · ${b.value} / ${b.target}${b.unit ? ` ${b.unit}` : ''}`}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="courses-title" className="space-y-2">
        <h2 id="courses-title" className="text-base font-semibold">Your courses</h2>
        {courses.length === 0 ? <p className="text-sm text-muted">No courses yet. Add one from the Library.</p> : (
          <ul aria-label="Your courses" className="flex flex-wrap gap-2">
            {courses.map(c => (
              <li key={c.id}>
                <Link href={`/library?course=${c.id}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 text-sm hover:bg-surface">
                  <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: c.color }} />{c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex gap-4 text-sm text-muted">
        <Link href="/settings" className="hover:text-fg">Settings</Link>
        <Link href="/library" className="hover:text-fg">Library</Link>
      </p>
    </div>
  )
}
