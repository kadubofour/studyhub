'use client'
import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, ClipboardCopy, Copy, FileText, Loader2, Mic, Paperclip, Pencil, RefreshCw, Square, Trash2, X } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { ProposalCard } from '@/components/tutor/ProposalCard'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useDictation } from '@/components/tutor/useDictation'
import { TutorPickDialog, type TutorTarget } from '@/components/tutor/TutorPickDialog'
import { usePlan } from '@/components/billing/usePlan'
import { AI_USED } from '@/components/ai/aiFetch'
import { Switch } from '@/components/ui/Switch'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { deleteChat, getChat, listMessages, renameChat, saveProposals, setChatContext, setChatCourse, setChatGuided, type TutorChat, type TutorMessage } from '@/lib/data/tutor'
import { FREE_DAILY_TUTOR_MESSAGES } from '@/lib/billing/plans'
import { FOLLOW_UPS, STARTERS, starterMessage } from '@/lib/tutor/starters'
import { dayHeading, nearBottom, questionText, timeOf, transcript } from '@/lib/tutor/conversation'
import { applyProposal } from '@/lib/tutor/apply'
import { sendTutorMessage } from '@/lib/tutor/stream'
import { addPending, readFile, uploadAttachments, type Pending } from '@/lib/tutor/attachClient'
import type { Attachment } from '@/lib/tutor/attachments'
import type { Proposal } from '@/lib/ai/tutorTools'
import type { Course } from '@/lib/types'
import { Dropdown, courseOptions } from '@/components/ui/Dropdown'
import { Working } from '@/components/ui/Working'

const nowMs = () => Date.now() // a plain function, so reading the clock in a click handler is not mistaken for reading it while drawing
const CHAT_KINDS: ('note' | 'lecture')[] = ['note', 'lecture'] // one array for good: a new one each render would make the picker load everything again
// An attachment that was sent, back in the bar: it is not uploaded again
const asPending = (a: Attachment): Pending => (a.kind === 'document' ? { id: crypto.randomUUID(), ...a } : a.kind === 'photo' ? { id: crypto.randomUUID(), kind: 'photo', name: a.name, pages: 1, sent: a } : { id: crypto.randomUUID(), kind: 'pdf', name: a.name, pages: a.pages, sent: a })
const forget = (p: Pending) => { if (p.kind === 'photo' && p.preview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(p.preview) }
const SOURCE_LINK = { note: (id: string) => `/notes/${id}`, lecture: (id: string) => `/lectures/${id}`, card: () => '/flashcards' }

export function ChatView({ chatId }: { chatId: string }) {
  const router = useRouter()
  const ask = useSearchParams().get('ask')
  const confirm = useConfirm()
  const toast = useToast()
  const [chat, setChat] = useState<TutorChat | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [text, setText] = useState(() => (ask ?? '').slice(0, 4000)) // a Revise button leaves the message ready; it is only sent when the student presses Send
  const [live, setLive] = useState<string | null>(null) // the reply being written; null when none
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null)
  const [attachedTitle, setAttachedTitle] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null) // the new name being typed; null when not renaming
  const [picking, setPicking] = useState(false)
  const plan = usePlan()
  const abort = useRef<AbortController | null>(null)
  const stopped = useRef(false) // the student pressed Stop: an ended reply is not an error
  const liveText = useRef('') // what has been written of the reply so far
  const startedAt = useRef(0)
  const [lastSent, setLastSent] = useState('') // the question just sent, which Try again asks again (it may never have been saved)
  const [lastAtts, setLastAtts] = useState<Attachment[]>([]) // and its files, already uploaded
  // Files and photos waiting in the bar. The ref is the same list, read at once by handlers that add several in a row
  const [pending, setPendingState] = useState<Pending[]>([])
  const pendingRef = useRef<Pending[]>([])
  const setPending = (list: Pending[]) => { pendingRef.current = list; setPendingState(list) }
  const [reading, setReading] = useState(0) // files being read
  const [uploading, setUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({}) // links to the photos and PDFs in the conversation
  const askedUrls = useRef(new Set<string>())
  const renameSettled = useRef(false) // Enter or Escape has decided the rename: the box losing focus afterwards must not decide it again
  const [partial, setPartial] = useState<string | null>(null) // what was written when the student stopped, until the saved reply is there to show
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const dictBase = useRef('') // what was in the box when dictation began; what is said goes after it
  const dictOn = useRef(false) // false once the message is sent, so words that arrive late do not fill the empty box again
  const dictation = useDictation(spoken => {
    if (!dictOn.current) return
    const said = spoken.trim()
    setText((said ? `${dictBase.current}${dictBase.current ? ' ' : ''}${said}` : dictBase.current).slice(0, 4000))
  })
  const toastLatest = useRef(toast)
  useEffect(() => { toastLatest.current = toast })
  useEffect(() => {
    if (dictation.error) toastLatest.current(dictation.error === 'not-allowed' || dictation.error === 'service-not-allowed' ? 'The microphone is blocked. Allow it in your browser settings.' : "Couldn't use the microphone.")
  }, [dictation.error])
  const lastY = useRef(0)
  const pinned = useRef(true) // the student is reading the newest text, so a reply is followed; scrolled up, the page stays where they put it
  const [away, setAway] = useState(false) // scrolled up from the newest text: offer a way back
  const [today] = useState(() => new Date(nowMs())) // for the day headings and the welcome
  const { profile } = useProfile()
  // The newest messages, read by proposal writes (a click's own render can be stale), and a queue so saves run one at a time
  const latest = useRef<TutorMessage[]>([])
  const writes = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    // Only the newest load counts: in development the effect runs twice, and the older answer arriving after the
    // student flipped Guided would flip it back (and a chat opened, left and opened again must not mix with the first)
    let current = true
    const sb = supabase()
    Promise.all([getChat(sb, chatId), listMessages(sb, chatId), listCourses(sb)]).then(async ([c, m, cs]) => {
      if (!current) return
      setChat(c); latest.current = m; setMessages(m); setCourses(cs)
      const table = c.note_id ? 'notes' : c.lecture_id ? 'lectures' : null
      const id = c.note_id ?? c.lecture_id
      if (table && id) {
        const { data } = await sb.from(table).select('id,title').eq('id', id).maybeSingle()
        if (current) setAttachedTitle((data as { title?: string } | null)?.title ?? null)
      }
    }).catch(() => { if (current) router.push('/tutor') })
    return () => { current = false }
  }, [chatId, router])
  useEffect(() => { if (pinned.current) end.current?.scrollIntoView?.({ block: 'end' }) }, [messages, live])
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const up = y < lastY.current - 2 // any scroll upward is the student leaving, however near the bottom they still are
      lastY.current = y
      const near = !up && nearBottom({ scrollY: y, viewport: window.innerHeight, endY: (end.current?.getBoundingClientRect().top ?? 0) + y })
      pinned.current = near; setAway(!near)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // The message box grows with what is typed, up to about eight lines
  useEffect(() => {
    const el = box.current
    if (!el || !el.scrollHeight) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`
  }, [text, chat])
  // Links for the photos and PDFs in the conversation, fetched once each (they last an hour)
  useEffect(() => {
    const paths = messages.flatMap(m => (m.attachments ?? []).flatMap(a => (a.kind === 'document' || askedUrls.current.has(a.path) ? [] : [a.path])))
    if (!paths.length) return
    paths.forEach(p => askedUrls.current.add(p))
    supabase().storage.from('tutor-files').createSignedUrls(paths, 3600)
      .then(({ data }) => { if (data) setFileUrls(u => ({ ...u, ...Object.fromEntries(data.flatMap(d => (d.signedUrl && d.path ? [[d.path, d.signedUrl]] : []))) })) })
      .catch(() => {})
  }, [messages])
  // The message from a Revise button is taken once: drop it from the address so a reload or Back does not fill the box again
  useEffect(() => { if (ask) router.replace(`/tutor/${chatId}`) }, [ask, chatId, router])

  async function reload() { const m = await listMessages(supabase(), chatId); latest.current = m; setMessages(m) }

  async function addFiles(files: File[]) {
    if (uploading) return // what is in the bar is being sent: nothing joins it now
    setAttachError(null)
    for (const f of files) {
      setReading(n => n + 1)
      const r = await readFile(f)
      setReading(n => n - 1)
      if ('error' in r) { setAttachError(r.error); continue }
      const res = addPending(pendingRef.current, r)
      setPending(res.list)
      if (res.error) { forget(r); setAttachError(res.error) }
    }
  }
  function removePending(id: string) {
    if (uploading) return
    const gone = pendingRef.current.find(p => p.id === id)
    if (gone) forget(gone)
    setPending(pendingRef.current.filter(p => p.id !== id))
  }

  // From the bar (no override): its text and files. Try again, Regenerate, follow-ups and hints pass their own text, and files already uploaded.
  async function send(override?: string, again?: Attachment[]) {
    const fromBar = override === undefined
    const message = (override ?? text).trim()
    const files = fromBar ? pendingRef.current : again ?? []
    if ((!message && !files.length) || live !== null || uploading || reading) return
    let atts: Attachment[] = again ?? []
    if (fromBar && files.length) {
      setUploading(true); setAttachError(null)
      try { atts = await uploadAttachments(pendingRef.current, profile.id, chatId) } catch (e) { setAttachError((e as Error).message); return } finally { setUploading(false) }
      pendingRef.current.forEach(forget)
      setPending([])
    }
    setLastAtts(atts)
    dictOn.current = false; dictation.stop()
    pinned.current = true; setAway(false) // sending a message goes to the newest text
    setProblem(null); setPartial(null); if (override === undefined) setText(''); setLive('')
    const control = new AbortController()
    abort.current = control; stopped.current = false; liveText.current = ''; startedAt.current = nowMs(); setLastSent(message)
    const shown = [...latest.current, { id: 'pending', chat_id: chatId, role: 'user' as const, content: message, sources: [], proposals: [], status: 'ok' as const, created_at: '', attachments: atts }]
    latest.current = shown; setMessages(shown)
    let r: Awaited<ReturnType<typeof sendTutorMessage>>
    try { r = await sendTutorMessage(chatId, message, control.signal, atts.length ? atts : undefined) } catch { setLive(null); await reload().catch(() => {}); return } // stopped before the reply began
    if (!r.ok) {
      // Refused (limit, speed, offline): keep what was typed so it isn't lost
      setProblem({ code: r.error, message: r.message })
      if (fromBar) { setText(message); if (atts.length && r.error !== 'attachment_missing') setPending(atts.map(asPending)) }
      setLive(null); await reload().catch(() => {}); return
    }
    const cutOff = { code: 'cut_off', message: 'The reply was cut off. Try again.' }
    let ended = false
    try {
      for await (const l of r.lines) {
        if (l.t === 'delta') { liveText.current += l.text; setLive(s => (s ?? '') + l.text) }
        else if (l.t === 'done') ended = true
        else if (l.t === 'error') { ended = true; setProblem(l.messageId ? cutOff : { code: l.error, message: 'Couldn\'t reach the AI. Try again.' }) }
      }
      if (!ended && !stopped.current) setProblem(cutOff) // the connection closed without finishing
    } catch { if (!stopped.current) setProblem(cutOff) } finally {
      // Stopped: keep what was written on the page, because the server saves the partial reply a moment after it hears the stop
      if (stopped.current) { setPartial(liveText.current.trim() ? liveText.current : null); window.dispatchEvent(new Event(AI_USED)) } // that message was used
      // The saved reply replaces the streamed one in a single update: the page must not shrink in between, or a reader scrolled up is carried to the bottom
      try { const m = await listMessages(supabase(), chatId); latest.current = m; setMessages(m) } catch { /* the next load shows it */ }
      setLive(null)
      try { const fresh = await getChat(supabase(), chatId); setChat(c => (c ? { ...fresh, guided: c.guided } : fresh)) } catch { /* the next load shows it */ }
    }
  }

  // Changes one proposal. Saves run one after another, each from the newest list, so two taps at
  // once can't write over each other. The card updates at once; a failed save rejects.
  function change(messageId: string, proposalId: string, patch: Partial<Proposal>): Promise<void> {
    const run = writes.current.then(async () => {
      const msg = latest.current.find(m => m.id === messageId)
      if (!msg) return
      const proposals = msg.proposals.map(p => (p.id === proposalId ? { ...p, ...patch } as Proposal : p))
      const next = latest.current.map(m => (m.id === messageId ? { ...m, proposals } : m))
      latest.current = next; setMessages(next)
      await saveProposals(supabase(), messageId, proposals)
    })
    writes.current = run.catch(() => {})
    return run
  }
  async function add(messageId: string, edited: Proposal) {
    const done = await applyProposal(supabase(), edited, { course_id: chat!.course_id, note_id: chat!.note_id })
    // The item exists now: show it as added even if saving that fact fails, so it isn't added twice
    try { await change(messageId, edited.id, { ...edited, state: 'added', ...done } as Partial<Proposal>) }
    catch { toast('Added. It may show as new again after a reload.') }
  }

  async function toggleGuided(on: boolean) {
    setChat(c => c && { ...c, guided: on })
    try { await setChatGuided(supabase(), chatId, on) }
    catch { setChat(c => c && { ...c, guided: !on }); toast('Couldn\'t change guided mode.') }
  }

  async function finishRename() {
    if (renameSettled.current) return
    renameSettled.current = true
    const title = renaming?.trim().slice(0, 200)
    setRenaming(null)
    if (!title || title === chat!.title) return
    try { await renameChat(supabase(), chatId, title); setChat(c => c && { ...c, title }) } catch { toast("Couldn't rename.") }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast('Copied.') } catch { toast("Couldn't copy. Select the text instead.") }
  }
  // What the chat is about: a note or a lecture, or neither. The tutor reads it from the next message on.
  function jumpToLatest() { pinned.current = true; setAway(false); end.current?.scrollIntoView?.({ block: 'end' }) }
  // A touch screen has no Shift key to start a new line with, so there Enter does that and the Send button sends
  function enterSends(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return false // Enter that picks a word while typing Chinese, Japanese or Korean is not Send
    return e.ctrlKey || e.metaKey || (!e.shiftKey && !window.matchMedia?.('(pointer: coarse)').matches)
  }
  async function aboutPicked(t: TutorTarget | null) {
    setPicking(false)
    try {
      await setChatContext(supabase(), chatId, t === null ? null : t.kind === 'lecture' ? { lecture_id: t.id } : { note_id: t.id })
      setChat(c => c && { ...c, note_id: t?.kind === 'note' ? t.id : null, lecture_id: t?.kind === 'lecture' ? t.id : null })
      setAttachedTitle(t?.title ?? null)
    } catch { toast("Couldn't change what this chat is about.") }
  }
  async function remove() {
    if (!await confirm({ title: 'Delete this chat?', body: 'Its messages are deleted for good. Anything you added from it stays.', confirmLabel: 'Delete', danger: true })) return
    try { await deleteChat(supabase(), chatId); router.push('/tutor') } catch { toast('Couldn\'t delete the chat.') }
  }

  if (!chat) return <Working kind="load" size="sm" label="Loading" className="text-sm text-muted" />
  const where = chat.note_id ? `/notes/${chat.note_id}` : chat.lecture_id ? `/lectures/${chat.lecture_id}` : null
  const last = messages[messages.length - 1]
  const lastQuestion = [...messages].reverse().find(m => m.role === 'user')
  const lastAsked = lastQuestion?.content
  const lastAskedAtts = lastQuestion?.attachments ?? []
  const idle = live === null
  // A question with no answer, a reply that was cut off, or a connection that failed: ask it again
  const retryText = problem ? lastSent || lastAsked : lastAsked // after a failure: the question that failed, which may not have been saved
  const retryAtts = problem ? lastAtts : lastAskedAtts
  const canRetry = idle && (!!retryText || retryAtts.length > 0) && (problem?.code === 'cut_off' || problem?.code === 'ai_failed' || last?.status === 'cut_off' || last?.role === 'user')
  const canFollowUp = idle && !chat.guided && !problem && last?.role === 'assistant' && last.status === 'ok'
  const left = plan.billing && !plan.isPremium && !plan.loading ? Math.max(0, FREE_DAILY_TUTOR_MESSAGES - plan.tutorToday) : null
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-3xl flex-col gap-3 max-md:min-h-[calc(100dvh-13rem)]">
      <div className="flex items-center gap-1">
        {renaming === null
          ? <h1 className="mr-auto min-w-0 truncate text-lg font-medium">{chat.title}</h1>
          : <input aria-label="Chat name" className="input mr-auto min-w-0 flex-1 text-lg font-medium" value={renaming} maxLength={200} autoFocus
              onChange={e => setRenaming(e.target.value)} onBlur={() => { void finishRename() }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void finishRename() } else if (e.key === 'Escape') { renameSettled.current = true; setRenaming(null) } }} />}
        {renaming === null && <button type="button" className="btn-ghost" aria-label="Rename" title="Rename" onClick={() => { renameSettled.current = false; setRenaming(chat.title) }}><Pencil size={15} aria-hidden /></button>}
        {messages.length > 0 && <button type="button" className="btn-ghost" aria-label="Copy chat" title="Copy the whole chat" onClick={() => { void copy(transcript(chat.title, messages)) }}><ClipboardCopy size={15} aria-hidden /></button>}
        <button type="button" className="btn-ghost text-danger" aria-label="Delete chat" title="Delete chat" onClick={remove}><Trash2 size={15} aria-hidden /></button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {where && attachedTitle ? <>About <Link className="text-accent" href={where}>{attachedTitle}</Link></> : <>Not about a note or lecture</>}
          <button type="button" className="underline underline-offset-2 hover:text-fg" onClick={() => setPicking(true)}>{where ? 'Change' : 'Choose one'}</button>
          {where && <button type="button" className="underline underline-offset-2 hover:text-fg" onClick={() => { void aboutPicked(null) }}>Remove</button>}
        </p>
        <Dropdown label="Course" size="sm" className="w-40" value={chat.course_id ?? ''} options={courseOptions(courses)}
          onChange={x => { const v = x || null; setChat({ ...chat, course_id: v }); void setChatCourse(supabase(), chatId, v) }} />
      </div>

      <div className="flex-1 space-y-3" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && live === null && (
          <div className="space-y-4 py-10 text-center">
            <h2 className="text-2xl font-medium">{today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening'}{profile.display_name ? `, ${profile.display_name}` : ''}</h2>
            <p className="mx-auto max-w-md text-sm text-muted">Ask anything about your courses. I&apos;ll start from your notes and say when I&apos;m going beyond them.</p>
            {/* ideas put a message in the box to finish and send; nothing is sent from here */}
            <div role="group" aria-label="Ideas to start with" className="flex flex-wrap justify-center gap-2">
              {STARTERS.map(s => (
                <button key={s.id} type="button" className="btn !rounded-full !text-xs pointer-coarse:!py-2.5"
                  onClick={() => { setText(starterMessage(s, where && attachedTitle ? attachedTitle : null).slice(0, 4000)); box.current?.focus() }}>{s.title}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const heading = dayHeading(m.created_at, today)
          const newDay = !!heading && heading !== dayHeading(messages[i - 1]?.created_at ?? '', today)
          const time = timeOf(m.created_at)
          return (
          <Fragment key={m.id}>
          {newDay && <h2 className="pt-1 text-center text-xs text-muted">{heading}</h2>}
          {m.role === 'user'
          ? (
            <div className="ml-auto flex max-w-[85%] flex-col items-end gap-0.5">
              {(m.attachments ?? []).length > 0 && (
                <ul aria-label="Attached" className="flex flex-wrap justify-end gap-1.5">
                  {m.attachments.map((a, j) => (
                    <li key={j} className="max-w-56">
                      {a.kind !== 'document' && fileUrls[a.path]
                        ? <a href={fileUrls[a.path]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-line bg-raised px-2.5 py-1.5 text-xs hover:border-accent">
                            {a.kind === 'photo' ? <img src={fileUrls[a.path]} alt="" className="size-8 rounded object-cover" /> : <FileText size={14} aria-hidden className="text-muted" />}
                            <span className="truncate">{a.name}</span>
                          </a>
                        : <span className="flex items-center gap-1.5 rounded-xl border border-line bg-raised px-2.5 py-1.5 text-xs"><FileText size={14} aria-hidden className="text-muted" /><span className="truncate">{a.name}</span></span>}
                    </li>
                  ))}
                </ul>
              )}
              {m.content && <p className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-sm">{m.content}</p>}
              {m.id !== 'pending' && (
                <div className="flex items-center gap-1 text-xs text-muted">
                  {time && <span>{time}</span>}
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs pointer-coarse:!px-3 pointer-coarse:!py-2.5" aria-label="Copy question" title="Copy" onClick={() => { void copy(questionText(m)) }}><Copy size={13} aria-hidden /></button>
                </div>
              )}
            </div>
          )
          : (
            <div className="space-y-2">
              <MarkdownView source={m.content} />
              {m.status === 'cut_off' && <p className="text-xs text-muted">Reply was cut off.</p>}
              {m.sources.length > 0 && (
                <p className="text-xs text-muted">From: {m.sources.map((s, i) => (
                  <span key={s.id}>{i > 0 && ', '}<Link className="text-accent" href={SOURCE_LINK[s.kind](s.id)}>{s.title}</Link></span>
                ))}</p>
              )}
              <div className="flex gap-1 text-muted">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs pointer-coarse:!px-3 pointer-coarse:!py-2.5" aria-label="Copy reply" title="Copy" onClick={() => { void copy(m.content) }}><Copy size={14} aria-hidden /></button>
                {m === last && idle && (!!lastAsked || lastAskedAtts.length > 0) && m.status === 'ok' && (
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs pointer-coarse:!px-3 pointer-coarse:!py-2.5" aria-label="Regenerate reply" title="Regenerate" onClick={() => { void send(lastAsked ?? '', lastAskedAtts) }}><RefreshCw size={14} aria-hidden /></button>
                )}
                {time && <span className="ml-auto self-center text-xs">{time}</span>}
              </div>
              {m.proposals.map(p => (
                <ProposalCard key={p.id} proposal={p} onAdd={e => add(m.id, e)} onDiscard={() => { change(m.id, p.id, { state: 'discarded' }).catch(() => toast('Couldn\'t save that.')) }} />
              ))}
            </div>
          )}
          </Fragment>
          )
        })}
        {partial && last?.role === 'user' && idle && (
          <div className="space-y-1"><MarkdownView source={partial} /><p className="text-xs text-muted">Stopped.</p></div>
        )}
        {live !== null && (live ? <MarkdownView source={live} /> : <Working kind="think" size="sm" label="Thinking" className="text-sm text-muted" />)}
        <div ref={end} />
      </div>

      {problem && <AiError code={problem.code} message={problem.message} />}
      {canRetry && <div><button type="button" className="btn" onClick={() => { void send(retryText ?? '', retryAtts) }}><RefreshCw size={14} aria-hidden />Try again</button></div>}
      {canFollowUp && (
        <div role="group" aria-label="Follow-up questions" className="flex flex-wrap gap-2">
          {FOLLOW_UPS.map(f => <button key={f.id} type="button" className="btn !rounded-full !text-xs pointer-coarse:!py-2.5" onClick={() => { void send(f.message) }}>{f.label}</button>)}
        </div>
      )}
      {chat.guided && messages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={live !== null} onClick={() => { void send('Give me a hint.') }}>Give me a hint</button>
          <button type="button" className="btn" disabled={live !== null} onClick={() => { void send('Show me the answer.') }}>Show the answer</button>
        </div>
      )}
      <form className="sticky bottom-0 bg-bg pb-3 pt-1 max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" onSubmit={e => { e.preventDefault(); void send() }}>
        {away && messages.length > 0 && (
          <button type="button" aria-label="Jump to latest" title="Latest" className="btn absolute -top-11 left-1/2 grid size-9 -translate-x-1/2 place-items-center !rounded-full !p-0 shadow-md" onClick={jumpToLatest}><ArrowDown size={16} aria-hidden /></button>
        )}
        {/* one rounded box, the way a chat is written: the text and its Send button together */}
        <div className="rounded-3xl border border-line bg-raised p-2 pl-4 shadow-sm focus-within:border-accent"
          onDragOver={e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault() }}
          onDrop={e => { const f = Array.from(e.dataTransfer?.files ?? []); if (f.length) { e.preventDefault(); void addFiles(f) } }}>
          {(pending.length > 0 || reading > 0) && (
            <ul aria-label="Files to send" className="flex flex-wrap gap-2 pb-1 pt-1">
              {pending.map(p => (
                <li key={p.id} className="flex max-w-60 items-center gap-1.5 rounded-xl border border-line bg-bg py-1 pl-1.5 pr-1 text-xs">
                  {p.kind === 'photo' && p.preview ? <img src={p.preview} alt="" className="size-8 rounded object-cover" /> : <FileText size={15} aria-hidden className="ml-1 text-muted" />}
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    {p.kind === 'pdf' && <span className="block text-muted">{p.pages} {p.pages === 1 ? 'page' : 'pages'}</span>}
                    {p.kind === 'document' && p.shortened && <span className="block text-muted">Only the start is read</span>}
                  </span>
                  <button type="button" aria-label={`Remove ${p.name}`} disabled={uploading} className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg pointer-coarse:size-9" onClick={() => removePending(p.id)}><X size={13} aria-hidden /></button>
                </li>
              ))}
              {reading > 0 && <li className="flex items-center rounded-xl border border-line px-2.5 py-1 text-xs text-muted"><Working kind="read" size="sm" label="Reading" /></li>}
            </ul>
          )}
          <textarea ref={box} className="block max-h-48 min-h-11 w-full resize-none border-0 bg-transparent py-2 text-sm outline-none focus:ring-0" rows={1} aria-label="Message" placeholder="Ask the tutor…" value={text} maxLength={4000}
            onChange={e => setText(e.target.value)} onKeyDown={e => { if (enterSends(e)) { e.preventDefault(); void send() } }}
            onPaste={e => {
              // Text wins: copying from Word or a web page often brings a picture of it too
              const f = Array.from(e.clipboardData?.files ?? [])
              if (f.length && !e.clipboardData.getData?.('text/plain')) { e.preventDefault(); void addFiles(f) }
            }} />
          <div className="flex items-center gap-2 pt-1">
            <button type="button" aria-label="Add files or photos" title="Add files or photos" disabled={uploading} className="btn-ghost -ml-2 grid size-10 shrink-0 place-items-center !rounded-full !p-0 text-muted" onClick={() => fileInput.current?.click()}><Paperclip size={18} aria-hidden /></button>
            <input ref={fileInput} type="file" multiple aria-label="Files to add" className="sr-only" tabIndex={-1}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.pdf,application/pdf,.docx,.pptx,.txt,.md,.markdown"
              onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) void addFiles(f) }} />
            <span className="flex items-center gap-2 text-xs text-muted">
              <span id="guided-label">Guided</span>
              <Switch checked={chat.guided} onChange={v => { void toggleGuided(v) }} labelledBy="guided-label" describedBy="guided-hint" />
              <span id="guided-hint" className="sr-only">The tutor asks you to try first and gives hints one step at a time.</span>
            </span>
            <span className="ml-auto flex items-center gap-1">
              {dictation.supported && (
                <button type="button" aria-label={dictation.listening ? 'Stop dictating' : 'Dictate'} aria-pressed={dictation.listening} title={dictation.listening ? 'Stop dictating' : 'Dictate'}
                  className={`btn-ghost grid size-10 place-items-center !rounded-full !p-0 ${dictation.listening ? '!bg-accent-soft text-accent motion-safe:animate-pulse' : 'text-muted'}`}
                  onClick={() => { if (dictation.listening) dictation.stop(); else { dictBase.current = text.trimEnd(); dictOn.current = true; dictation.start() } }}><Mic size={18} aria-hidden /></button>
              )}
              {live !== null
                ? <button key="stop" type="button" aria-label="Stop" title="Stop" className="btn-primary grid size-10 shrink-0 place-items-center !rounded-full !p-0" onClick={() => {
                  if (nowMs() - startedAt.current < 600) return // the second tap of a double tap on Send
                  stopped.current = true
                  abort.current?.abort()
                }}><Square size={14} className="fill-current" aria-hidden /></button>
                : <button key="send" aria-label="Send" title="Send" className="btn-primary grid size-10 shrink-0 place-items-center !rounded-full !p-0" disabled={(!text.trim() && !pending.length) || reading > 0 || uploading}>{uploading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ArrowUp size={18} aria-hidden />}</button>}
            </span>
          </div>
        </div>
      </form>
      {attachError && <p role="alert" className="-mt-1 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{attachError}</p>}
      {text.length >= 3500 && <p className="-mt-1 pb-1 text-right text-xs text-muted">{text.length} / {4000}</p>}
      {left !== null && <p className="-mt-1 pb-2 text-center text-xs text-muted" aria-live="polite">{left} of {FREE_DAILY_TUTOR_MESSAGES} tutor messages left today</p>}
      <TutorPickDialog open={picking} onClose={() => setPicking(false)} onPick={t => { void aboutPicked(t) }} kinds={CHAT_KINDS} title="What is this chat about?" />
    </div>
  )
}
