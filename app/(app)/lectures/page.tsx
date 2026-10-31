'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, FileText, FolderInput, Mic, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { ItemList, ItemTile } from '@/components/ui/ItemTile'
import { StackTile } from '@/components/ui/StackTile'
import { ViewOptions } from '@/components/ui/ViewOptions'
import { VIEW_CHOICES, sortLectures, useView, viewStore } from '@/lib/ui/listView'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseTag } from '@/components/ui/CourseTag'
import { Dialog } from '@/components/ui/Dialog'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { StorageMessage } from '@/components/settings/StorageCard'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { audioUsed, deleteLecture, getLecture, listLectures, updateLecture, type LectureSummary, type TranscriptStatus } from '@/lib/data/lectures'
import { indexedDbStore, type LocalSession } from '@/lib/lectures/localStore'
import { finishRecording } from '@/lib/lectures/saveRecording'
import { makeAiNote, makeFreeNote } from '@/lib/lectures/lectureNotes'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { AUDIO_QUOTA_BYTES, formatClock, formatMb, storageState } from '@/lib/lectures/time'
import type { Course } from '@/lib/types'
import { Dropdown, courseOptions } from '@/components/ui/Dropdown'
import { ComposeButton, PhoneCount, PhoneEmpty, PhoneGroup, PhoneRow, PhoneSearch, PhoneTitle, StripMark, tick } from '@/components/ui/PhoneList'
import { groupByDate, rowDate } from '@/lib/notes/noteRows'
import { showsComputer, showsPhone, useScreen } from '@/lib/ui/useScreen'

const STATUS: Record<TranscriptStatus, string> = {
  none: 'No transcript', live: 'Live transcript', processing: 'Transcribing…', done: 'Accurate transcript', failed: 'Transcript failed',
}
// The live transcript stays until the accurate one is complete, so a stopped or paused accurate
// transcript still leaves the lecture with its live one
const statusOf = (l: LectureSummary) =>
  (l.transcript_source === 'browser' && (l.transcript_status === 'failed' || l.transcript_status === 'processing') ? 'Live transcript' : STATUS[l.transcript_status])
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

type Editing = { kind: 'rename' | 'course'; lecture: LectureSummary; value: string }

export default function LecturesPage() {
  const router = useRouter()
  const { profile } = useProfile()
  const confirm = useConfirm()
  const toast = useToast()
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [used, setUsed] = useState(0)
  const [leftover, setLeftover] = useState<LocalSession | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; lecture: LectureSummary } | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState(false)
  const view = useView('lectures')
  const screen = useScreen()
  const [q, setQ] = useState('')
  const [now] = useState(() => new Date())

  useEffect(() => {
    const sb = supabase()
    // If storage used can't be counted, still list the lectures (and treat storage as unknown: 0)
    Promise.all([listLectures(sb), listCourses(sb), audioUsed(sb).catch(() => 0)])
      .then(([l, c, u]) => { setLectures(l); setCourses(c); setUsed(u) })
      .catch(() => setLectures([]))
    // Only this student's: a shared device may hold someone else's unsaved recording
    indexedDbStore().sessions().then(s => setLeftover(s.find(x => x.userId === profile.id) ?? null)).catch(() => {})
  }, [profile.id])

  async function discard() {
    if (!leftover) return
    if (!await confirm({ title: 'Discard this recording?', body: 'It was never saved, and it will be deleted from this device.', confirmLabel: 'Discard', danger: true })) return
    await indexedDbStore().remove(leftover.id).catch(() => {})
    setLeftover(null)
  }

  async function recover() {
    if (!leftover) return
    setRecovering(true); setError(null)
    try {
      const { id } = await finishRecording(supabase(), indexedDbStore(), leftover)
      router.push(`/lectures/${id}`)
    } catch (e) {
      setError((e as Error).message === 'nothing_recorded' ? 'Nothing was recorded in it.' : 'Couldn\'t upload it. Check your connection and try again.')
      setRecovering(false)
    }
  }

  // Quick actions: right-click / long-press a lecture, or its ⋯ button
  function openMenu(e: React.MouseEvent, lecture: LectureSummary) {
    e.preventDefault()
    // From the keyboard or the ⋯ button there's no pointer spot: use the element's corner
    const fromPointer = e.type === 'contextmenu' && (e.clientX || e.clientY)
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ x: fromPointer ? e.clientX : r.left, y: fromPointer ? e.clientY : r.bottom, lecture })
  }

  async function note(lecture: LectureSummary, withAi: boolean) {
    try {
      const sb = supabase()
      const full = await getLecture(sb, lecture.id)
      if (!full.transcript.length) { toast('This lecture has no transcript yet.'); return }
      if (!withAi) { router.push(`/notes/${await makeFreeNote(sb, full)}`); return }
      const r = await makeAiNote(sb, full)
      if (r.ok) router.push(`/notes/${r.noteId}`)
      else toast(r.message)
    } catch { toast('Couldn\'t make the note. Try again.') }
  }

  async function remove(lecture: LectureSummary) {
    if (!await confirm({ title: 'Delete this lecture?', body: `“${lecture.title}”, its recording and transcript are deleted for good.`, confirmLabel: 'Delete', danger: true })) return
    try {
      const sb = supabase()
      await deleteLecture(sb, await getLecture(sb, lecture.id))
      setLectures(ls => ls?.filter(x => x.id !== lecture.id) ?? ls)
    } catch { toast('Couldn\'t delete the lecture.') }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const patch = editing.kind === 'rename'
      ? { title: editing.value.trim().slice(0, 200) }
      : { course_id: editing.value || null }
    if (editing.kind === 'rename' && !patch.title) return
    setBusy(true)
    try {
      await updateLecture(supabase(), editing.lecture.id, patch)
      setLectures(ls => ls?.map(x => (x.id === editing.lecture.id ? { ...x, ...patch } : x)) ?? ls)
      setEditing(null)
    } catch { toast('Couldn\'t save.') } finally { setBusy(false) }
  }

  const menuItems = (l: LectureSummary): MenuEntry[] => [
    { label: 'Open', icon: ExternalLink, onSelect: () => router.push(`/lectures/${l.id}`) },
    { label: 'Rename', icon: Pencil, onSelect: () => setEditing({ kind: 'rename', lecture: l, value: l.title }) },
    { label: 'Change course', icon: FolderInput, onSelect: () => setEditing({ kind: 'course', lecture: l, value: l.course_id ?? '' }) },
    'sep',
    { label: 'Make a note (free)', icon: FileText, onSelect: () => { void note(l, false) } },
    { label: '✦ Make a note with AI', icon: Sparkles, onSelect: () => { void note(l, true) } },
    'sep',
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => { void remove(l) } },
  ]

  const full = storageState(used) === 'full'
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  const unsaved = leftover && (
    <div role="status" className="card mb-4 space-y-2">
      <p className="text-sm">A recording wasn&apos;t saved: <b>{leftover.title}</b>.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={recovering} onClick={recover}>{recovering ? 'Saving…' : 'Recover unsaved recording'}</button>
        <button type="button" className="btn" disabled={recovering} onClick={discard}>Discard</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
  // On a phone, as the notes list is: by the day recorded, each with its sound strip, length and transcript
  const term = q.trim().toLowerCase()
  const phoneShown = sortLectures(lectures ?? [], view.sort).filter(l => !term || l.title.toLowerCase().includes(term))
  const phoneGroups = view.sort === 'newest' && !term
    ? groupByDate(phoneShown.map(l => ({ ...l, updated_at: l.recorded_at })), now)
    : [{ label: '', notes: phoneShown.map(l => ({ ...l, updated_at: l.recorded_at })) }]

  return (
    <div>
      {showsPhone(screen) && <div className="pb-24 md:hidden">
        <PhoneTitle title="Lectures" menuLabel="Lectures options" menu={VIEW_CHOICES.lectures.sorts.map(s => tick(s.label, view.sort === s.value, () => viewStore('lectures').set({ ...view, sort: s.value })))} />
        {unsaved}
        <div className="mb-3 space-y-1"><p className="text-[13px] text-muted">{formatMb(used)} of {formatMb(AUDIO_QUOTA_BYTES)} audio</p><StorageMessage used={used} /></div>
        <PhoneSearch label="Search lectures" value={q} onChange={setQ} />
        {lectures?.length === 0 && <PhoneEmpty>No lectures yet. Tap the microphone at the start of your next lecture.</PhoneEmpty>}
        {!!lectures?.length && phoneShown.length === 0 && <PhoneEmpty>No lectures match.</PhoneEmpty>}
        {phoneGroups.map(g => g.notes.length > 0 && (
          <PhoneGroup key={g.label || 'all'} label={g.label} name="Lectures">
            {g.notes.map(l => (
              <PhoneRow key={l.id} href={`/lectures/${l.id}`} title={l.title} mark={<StripMark color={courseOf(l.course_id)?.color} />}
                date={rowDate(l.recorded_at, now)} line={`${formatClock(l.duration_seconds)} · ${statusOf(l)}`} onContextMenu={e => openMenu(e, l)} />
            ))}
          </PhoneGroup>
        ))}
        <PhoneCount n={phoneShown.length} one="lecture" many="lectures" />
        {!full && <ComposeButton label="Record a lecture" icon={Mic} href="/lectures/record" />}
      </div>}
      {showsComputer(screen) && <div className="max-md:hidden">
      <PageHeader title="Lectures" actions={!full && <Link href="/lectures/record" className="btn-primary"><Mic size={14} aria-hidden />Record</Link>} />
      {unsaved}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs text-muted">{formatMb(used)} of {formatMb(AUDIO_QUOTA_BYTES)} audio</p>
          <StorageMessage used={used} />
        </div>
        {!!lectures?.length && <ViewOptions page="lectures" />}
      </div>
      {lectures?.length === 0 && <EmptyState icon={Mic} tone="c" title="Capture your next lecture" body="No lectures yet. Press Record at the start of your next lecture." />}
      <ItemList label="Lectures" layout={view.layout}>
        {sortLectures(lectures ?? [], view.sort).map(l => {
          const c = courseOf(l.course_id)
          if (view.layout === 'grid') return (
            <StackTile key={l.id} motif="strip" color={c?.color} title={l.title} href={`/lectures/${l.id}`} tag={c && <CourseTag course={c} />}
              big={formatClock(l.duration_seconds)} bigLabel={`recorded ${day(l.recorded_at)}`} side={statusOf(l)}
              onMenu={e => openMenu(e, l)} onContextMenu={e => openMenu(e, l)} />
          )
          return (
            <ItemTile key={l.id} layout={view.layout} icon={Mic} color={c?.color} title={l.title} href={`/lectures/${l.id}`}
              subtitle={<><span>{day(l.recorded_at)}</span> · <span>{formatClock(l.duration_seconds)}</span></>} meta={c && <CourseTag course={c} />} aside={statusOf(l)}
              onMenu={e => openMenu(e, l)} onContextMenu={e => openMenu(e, l)} />
          )
        })}
      </ItemList>
      </div>}
      {menu && <ContextMenu x={menu.x} y={menu.y} label={menu.lecture.title} items={menuItems(menu.lecture)} onClose={() => setMenu(null)} />}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.kind === 'course' ? 'Change course' : 'Rename lecture'}>
        {editing && (
          <form onSubmit={saveEdit} className="space-y-4">
            {editing.kind === 'rename'
              ? <label className="field"><span>Lecture title</span><input autoFocus maxLength={200} value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} /></label>
              : (
                <div className="field"><span>Course</span>
                  <Dropdown label="Course" value={editing.value} onChange={v => setEditing({ ...editing, value: v })} options={courseOptions(courses)} />
                </div>
              )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy}>Save</button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  )
}
