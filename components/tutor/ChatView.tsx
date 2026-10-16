'use client'
import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ClipboardCopy, Copy, Pencil, RefreshCw, Square, Trash2 } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { ProposalCard } from '@/components/tutor/ProposalCard'
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
import { dayHeading, nearBottom, timeOf, transcript } from '@/lib/tutor/conversation'
import { applyProposal } from '@/lib/tutor/apply'
import { sendTutorMessage } from '@/lib/tutor/stream'
import type { Proposal } from '@/lib/ai/tutorTools'
import type { Course } from '@/lib/types'

const nowMs = () => Date.now() // a plain function, so reading the clock in a click handler is not mistaken for reading it while drawing
const CHAT_KINDS: ('note' | 'lecture')[] = ['note', 'lecture'] // one array for good: a new one each render would make the picker load everything again
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
  const renameSettled = useRef(false) // Enter or Escape has decided the rename: the box losing focus afterwards must not decide it again
  const [partial, setPartial] = useState<string | null>(null) // what was written when the student stopped, until the saved reply is there to show
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const lastY = useRef(0)
  const pinned = useRef(true) // the student is reading the newest text, so a reply is followed; scrolled up, the page stays where they put it
  const [away, setAway] = useState(false) // scrolled up from the newest text: offer a way back
  const [today] = useState(() => new Date(nowMs())) // for the day headings
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
  // The message from a Revise button is taken once: drop it from the address so a reload or Back does not fill the box again
  useEffect(() => { if (ask) router.replace(`/tutor/${chatId}`) }, [ask, chatId, router])

  async function reload() { const m = await listMessages(supabase(), chatId); latest.current = m; setMessages(m) }

  async function send(override?: string) {
    const message = (override ?? text).trim()
    if (!message || live !== null) return
    pinned.current = true; setAway(false) // sending a message goes to the newest text
    setProblem(null); setPartial(null); if (override === undefined) setText(''); setLive('')
    const control = new AbortController()
    abort.current = control; stopped.current = false; liveText.current = ''; startedAt.current = nowMs(); setLastSent(message)
    const shown = [...latest.current, { id: 'pending', chat_id: chatId, role: 'user' as const, content: message, sources: [], proposals: [], status: 'ok' as const, created_at: '' }]
    latest.current = shown; setMessages(shown)
    let r: Awaited<ReturnType<typeof sendTutorMessage>>
    try { r = await sendTutorMessage(chatId, message, control.signal) } catch { setLive(null); await reload().catch(() => {}); return } // stopped before the reply began
    if (!r.ok) {
      // Refused (limit, speed, offline): keep what was typed so it isn't lost
      setProblem({ code: r.error, message: r.message }); if (override === undefined) setText(message); setLive(null); await reload().catch(() => {}); return
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

  if (!chat) return <p className="text-sm text-muted">Loading…</p>
  const where = chat.note_id ? `/notes/${chat.note_id}` : chat.lecture_id ? `/lectures/${chat.lecture_id}` : null
  const last = messages[messages.length - 1]
  const lastAsked = [...messages].reverse().find(m => m.role === 'user')?.content
  const idle = live === null
  // A question with no answer, a reply that was cut off, or a connection that failed: ask it again
  const retryText = problem ? lastSent || lastAsked : lastAsked // after a failure: the question that failed, which may not have been saved
  const canRetry = idle && !!retryText && (problem?.code === 'cut_off' || problem?.code === 'ai_failed' || last?.status === 'cut_off' || last?.role === 'user')
  const canFollowUp = idle && !chat.guided && !problem && last?.role === 'assistant' && last.status === 'ok'
  const left = plan.billing && !plan.isPremium && !plan.loading ? Math.max(0, FREE_DAILY_TUTOR_MESSAGES - plan.tutorToday) : null
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {renaming === null
          ? <h1 className="mr-auto text-lg font-medium">{chat.title}</h1>
          : <input aria-label="Chat name" className="input mr-auto min-w-0 flex-1 text-lg font-medium" value={renaming} maxLength={200} autoFocus
              onChange={e => setRenaming(e.target.value)} onBlur={() => { void finishRename() }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void finishRename() } else if (e.key === 'Escape') { renameSettled.current = true; setRenaming(null) } }} />}
        <select className="input max-w-40" aria-label="Course" value={chat.course_id ?? ''} onChange={e => { const v = e.target.value || null; setChat({ ...chat, course_id: v }); void setChatCourse(supabase(), chatId, v) }}>
          <option value="">No course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="flex items-center gap-2 text-sm">
          <span id="guided-label">Guided</span>
          <Switch checked={chat.guided} onChange={v => { void toggleGuided(v) }} labelledBy="guided-label" describedBy="guided-hint" />
          <span id="guided-hint" className="sr-only">The tutor asks you to try first and gives hints one step at a time.</span>
        </span>
        {renaming === null && <button type="button" className="btn" onClick={() => { renameSettled.current = false; setRenaming(chat.title) }}><Pencil size={14} aria-hidden />Rename</button>}
        {messages.length > 0 && <button type="button" className="btn-ghost" aria-label="Copy chat" title="Copy the whole chat" onClick={() => { void copy(transcript(chat.title, messages)) }}><ClipboardCopy size={15} aria-hidden /></button>}
        <button type="button" className="btn-ghost text-danger" aria-label="Delete chat" onClick={remove}><Trash2 size={15} aria-hidden /></button>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {where && attachedTitle ? <>About <Link className="text-accent" href={where}>{attachedTitle}</Link></> : <>Not about a note or lecture</>}
        <button type="button" className="underline underline-offset-2 hover:text-fg" onClick={() => setPicking(true)}>{where ? 'Change' : 'Choose one'}</button>
        {where && <button type="button" className="underline underline-offset-2 hover:text-fg" onClick={() => { void aboutPicked(null) }}>Remove</button>}
      </p>

      <div className="space-y-3" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && live === null && (
          <div className="card space-y-3 py-6 text-center">
            <p className="text-sm text-muted">Ask anything. I&apos;ll start from your notes and say when I&apos;m going beyond them.</p>
            {/* ideas put a message in the box to finish and send; nothing is sent from here */}
            <div role="group" aria-label="Ideas to start with" className="flex flex-wrap justify-center gap-2">
              {STARTERS.map(s => (
                <button key={s.id} type="button" className="btn !text-xs pointer-coarse:!py-2.5"
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
              <p className="whitespace-pre-wrap rounded-2xl bg-accent-soft px-3 py-2 text-sm">{m.content}</p>
              {m.id !== 'pending' && (
                <div className="flex items-center gap-1 text-xs text-muted">
                  {time && <span>{time}</span>}
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs pointer-coarse:!px-3 pointer-coarse:!py-2.5" aria-label="Copy question" onClick={() => { void copy(m.content) }}><Copy size={12} aria-hidden />Copy</button>
                </div>
              )}
            </div>
          )
          : (
            <div className="max-w-[95%] space-y-2">
              <MarkdownView source={m.content} />
              {m.status === 'cut_off' && <p className="text-xs text-muted">Reply was cut off.</p>}
              {m.sources.length > 0 && (
                <p className="text-xs text-muted">From: {m.sources.map((s, i) => (
                  <span key={s.id}>{i > 0 && ', '}<Link className="text-accent" href={SOURCE_LINK[s.kind](s.id)}>{s.title}</Link></span>
                ))}</p>
              )}
              <div className="flex gap-1 text-muted">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs pointer-coarse:!px-3 pointer-coarse:!py-2.5" aria-label="Copy reply" onClick={() => { void copy(m.content) }}><Copy size={13} aria-hidden />Copy</button>
                {m === last && idle && !!lastAsked && m.status === 'ok' && (
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs pointer-coarse:!px-3 pointer-coarse:!py-2.5" aria-label="Regenerate reply" onClick={() => { void send(lastAsked) }}><RefreshCw size={13} aria-hidden />Regenerate</button>
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
          <div className="max-w-[95%] space-y-1"><MarkdownView source={partial} /><p className="text-xs text-muted">Stopped.</p></div>
        )}
        {live !== null && (live ? <MarkdownView source={live} /> : <p role="status" className="text-sm text-muted motion-safe:animate-pulse">Thinking…</p>)}
        <div ref={end} />
      </div>

      {problem && <AiError code={problem.code} message={problem.message} />}
      {canRetry && <div><button type="button" className="btn" onClick={() => { void send(retryText) }}><RefreshCw size={14} aria-hidden />Try again</button></div>}
      {canFollowUp && (
        <div role="group" aria-label="Follow-up questions" className="flex flex-wrap gap-2">
          {FOLLOW_UPS.map(f => <button key={f.id} type="button" className="btn !text-xs pointer-coarse:!py-2.5" onClick={() => { void send(f.message) }}>{f.label}</button>)}
        </div>
      )}
      {chat.guided && messages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={live !== null} onClick={() => { void send('Give me a hint.') }}>Give me a hint</button>
          <button type="button" className="btn" disabled={live !== null} onClick={() => { void send('Show me the answer.') }}>Show the answer</button>
        </div>
      )}
      <form className="sticky bottom-0 flex gap-2 bg-bg pb-3 pt-1 max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" onSubmit={e => { e.preventDefault(); void send() }}>
        {away && messages.length > 0 && (
          <button type="button" aria-label="Jump to latest" className="btn absolute -top-11 left-1/2 -translate-x-1/2 shadow-md" onClick={jumpToLatest}><ArrowDown size={14} aria-hidden />Latest</button>
        )}
        <textarea ref={box} className="input max-h-48 min-h-11 flex-1 resize-none" rows={2} aria-label="Message" placeholder="Ask the tutor…" value={text} maxLength={4000}
          onChange={e => setText(e.target.value)} onKeyDown={e => { if (enterSends(e)) { e.preventDefault(); void send() } }} />
        {live !== null
          ? <button key="stop" type="button" className="btn self-end" onClick={() => {
            if (nowMs() - startedAt.current < 600) return // the second tap of a double tap on Send
            stopped.current = true
            abort.current?.abort()
          }}><Square size={13} className="fill-current" aria-hidden />Stop</button>
          : <button key="send" className="btn-primary self-end" disabled={!text.trim()}>Send</button>}
      </form>
      {text.length >= 3500 && <p className="-mt-1 pb-1 text-right text-xs text-muted">{text.length} / {4000}</p>}
      {left !== null && <p className="-mt-1 pb-2 text-center text-xs text-muted" aria-live="polite">{left} of {FREE_DAILY_TUTOR_MESSAGES} tutor messages left today</p>}
      <TutorPickDialog open={picking} onClose={() => setPicking(false)} onPick={t => { void aboutPicked(t) }} kinds={CHAT_KINDS} title="What is this chat about?" />
    </div>
  )
}
