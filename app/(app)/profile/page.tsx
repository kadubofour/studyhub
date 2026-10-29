'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Flame, FolderOpen, Layers, Mic, NotebookPen, Pencil, ListChecks, Settings, Star, Timer, Trophy, Zap, type LucideIcon } from 'lucide-react'
import { Avatar } from '@/components/profile/Avatar'
import { PreferencesCard } from '@/components/profile/PreferencesCard'
import { usePlan } from '@/components/billing/usePlan'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useXp } from '@/components/xp/useXp'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { getProfileStats, updateProfile } from '@/lib/data/profile'
import { AVATAR_COLORS, AVATAR_NAMES } from '@/lib/profile/avatar'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'
import type { Stats } from '@/lib/profile/stats'
import type { Course } from '@/lib/types'

const TILE_ICON: Record<string, LucideIcon> = { Level: Trophy, Streak: Flame, 'Best streak': Flame, 'Focus time': Timer, Notes: NotebookPen, Flashcards: Layers, Lectures: Mic, 'Quizzes finished': ListChecks }
const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Who the student is and what they have done
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

  const sub = [profile.programme, profile.school].filter(Boolean).join(' · ')
  const tiles: [string, string, 'a' | 'b' | 'c'][] = [
    ...(xp ? [['Streak', days(xp.streak), 'a'], ['Best streak', days(xp.best), 'b']] as [string, string, 'a' | 'b' | 'c'][] : []),
    ...(stats ? [['Focus time', fmtMinutes(stats.focus_minutes), 'c'], ['Notes', String(stats.notes), 'b'], ['Flashcards', String(stats.cards), 'a'], ['Lectures', String(stats.lectures), 'c'], ['Quizzes finished', String(stats.quizzes_done), 'b']] as [string, string, 'a' | 'b' | 'c'][] : []),
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* On a phone the whole card is the student's colour, with the avatar and name in the middle, like a banking app's profile */}
      <section className="card overflow-hidden p-0 max-md:!border-transparent max-md:text-white max-md:[background:linear-gradient(160deg,var(--avatar),color-mix(in_srgb,var(--avatar)_62%,#0b0b16))]" aria-labelledby="profile-name" style={{ '--avatar': profile.avatar_color } as React.CSSProperties}>
        <div aria-hidden="true" className="h-16 max-md:hidden" style={{ background: `linear-gradient(135deg, ${profile.avatar_color}, color-mix(in srgb, ${profile.avatar_color} 55%, #ffffff))` }} />
        <div className="flex flex-col items-start gap-3 px-5 pb-5 max-md:items-center max-md:pb-6 max-md:pt-8 max-md:text-center sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <span className="-mt-10 rounded-full bg-raised p-1 max-md:mt-0 max-md:bg-white/25"><Avatar name={profile.display_name} email={email} color={profile.avatar_color} size={80} /></span>
          <div className="min-w-0 w-full pt-1 sm:w-auto sm:flex-1 sm:pt-2">
            <h1 id="profile-name" className="truncate text-2xl font-semibold max-md:text-[1.75rem] max-md:font-bold max-md:tracking-tight">{profile.display_name || 'Your profile'}</h1>
            {sub && <p className="text-sm">{sub}</p>}
            {email && <p className="text-sm text-muted max-md:text-white/80">{email}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted max-md:justify-center max-md:text-white/80">
              {joined && <span>Member since {joined.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>}
              {plan.billing && !plan.loading && <span className="font-medium text-accent max-md:text-white">{plan.isPremium && plan.premiumUntil ? `Premium until ${longDate(plan.premiumUntil)}` : 'Free plan'}</span>}
            </p>
          </div>
          {!editing && <button type="button" className="btn max-md:!border-transparent max-md:!bg-white/20 max-md:!text-white" onClick={startEditing}><Pencil size={14} aria-hidden />Edit profile</button>}
        </div>
      </section>

      {editing && (
        <form onSubmit={save} className="card space-y-3" aria-label="Edit profile">
          <label className="field"><span>Name</span><input value={form.name} maxLength={80} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field"><span>School</span><input value={form.school} maxLength={80} onChange={e => setForm({ ...form, school: e.target.value })} placeholder="University of Ghana" /></label>
          <label className="field"><span>Programme</span><input value={form.programme} maxLength={80} onChange={e => setForm({ ...form, programme: e.target.value })} placeholder="Biology" /></label>
          <div>
            <div className="mb-1.5 text-sm text-muted">Avatar colour</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar colour">
              {AVATAR_COLORS.map((c, i) => {
                const on = form.color.toLowerCase() === c.toLowerCase()
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} aria-label={AVATAR_NAMES[i]} tabIndex={on ? 0 : -1} onClick={() => setForm({ ...form, color: c })}
                    onKeyDown={e => {
                      const to = radioKeyTarget(e.key, i, AVATAR_COLORS.length)
                      if (to === null) return
                      e.preventDefault(); setForm({ ...form, color: AVATAR_COLORS[to] }); focusRadio(e.currentTarget, to)
                    }}
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
        <h2 id="totals-title" className="section-label !mb-0">Your study so far</h2>
        {statsFailed && <p role="alert" className="text-sm text-danger">Could not load your study totals. Check your connection.</p>}
        {(tiles.length > 0 || xp) && (
        <div className="card space-y-5">
        {xp && (
          <div className="flex items-center gap-4">
            <div data-testid="level-ring" aria-hidden="true" className="relative flex size-20 shrink-0 items-center justify-center text-3xl font-semibold">
              <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                <circle cx="40" cy="40" r="35" fill="none" stroke="var(--surface)" strokeWidth="7" />
                <circle cx="40" cy="40" r="35" fill="none" stroke="var(--accent-solid)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 35} strokeDashoffset={2 * Math.PI * 35 * (1 - xp.level.into / xp.level.span)} />
              </svg>
              {xp.level.level}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2"><span className="flex items-center gap-1.5 text-lg font-semibold"><Zap size={16} className="text-accent" aria-hidden="true" />Level {xp.level.level}</span><span className="text-sm text-muted">{xp.total} XP in all</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Progress to level ${xp.level.level + 1}`} aria-valuenow={xp.level.into} aria-valuemin={0} aria-valuemax={xp.level.span} aria-valuetext={`${xp.level.into} of ${xp.level.span} XP`}>
                <div className="h-2.5 rounded-full bg-accent-solid" style={{ width: `${Math.round((xp.level.into / xp.level.span) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{xp.level.toNext} XP to level {xp.level.level + 1}</p>
            </div>
          </div>
        )}
        {tiles.length > 0 && (
          <ul aria-label="Study totals" className={`grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4 ${xp ? 'border-t border-line pt-5' : ''}`}>
            {tiles.map(([label, value, tone]) => (
              <li key={label} className="flex items-center gap-3">
                {(() => { const Icon = TILE_ICON[label] ?? Star; return <span aria-hidden="true" className={`tile-${tone} flex size-11 shrink-0 items-center justify-center rounded-2xl border border-line`}><Icon size={22} className="text-accent" aria-hidden="true" /></span> })()}
                <div className="min-w-0">
                  <div className="truncate text-2xl font-semibold leading-tight">{value}</div>
                  <div className="text-xs leading-tight text-muted">{label}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>
        )}
      </section>

      <PreferencesCard />

      <section aria-labelledby="courses-title" className="space-y-2">
        <h2 id="courses-title" className="section-label !mb-0">Your courses</h2>
        {courses.length === 0 ? <p className="text-sm text-muted">No courses yet. Add one in the Planner.</p> : (
          <ul aria-label="Your courses" className="flex flex-wrap gap-2">
            {courses.map(c => (
              <li key={c.id}>
                <Link href={`/courses/${c.id}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 text-sm hover:bg-surface">
                  <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: c.color }} />{c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex gap-4 text-sm text-muted max-md:hidden">
        <Link href="/settings" className="hover:text-fg">Settings</Link>
        <Link href="/library" className="hover:text-fg">Library</Link>
      </p>
      {/* on a phone, the same two places as a list of rows */}
      <nav aria-label="More" className="card !p-2 md:hidden">
        {([['/settings', 'Settings', Settings], ['/library', 'Library', FolderOpen]] as const).map(([href, label, Icon]) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition active:bg-surface">
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-surface text-muted"><Icon size={18} /></span>{label}
            <ChevronRight size={18} className="ml-auto text-muted" aria-hidden />
          </Link>
        ))}
      </nav>
    </div>
  )
}
