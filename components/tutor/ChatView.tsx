'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { ProposalCard } from '@/components/tutor/ProposalCard'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { deleteChat, getChat, listMessages, renameChat, saveProposals, setChatCourse, type TutorChat, type TutorMessage } from '@/lib/data/tutor'
import { applyProposal } from '@/lib/tutor/apply'
import { sendTutorMessage } from '@/lib/tutor/stream'
import type { Proposal } from '@/lib/ai/tutorTools'
import type { Course } from '@/lib/types'

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
  const end = useRef<HTMLDivElement>(null)
  // The newest messages, read by proposal writes (a click's own render can be stale), and a queue so saves run one at a time
  const latest = useRef<TutorMessage[]>([])
  const writes = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    const sb = supabase()
    Promise.all([getChat(sb, chatId), listMessages(sb, chatId), listCourses(sb)]).then(async ([c, m, cs]) => {
      setChat(c); latest.current = m; setMessages(m); setCourses(cs)
      const table = c.note_id ? 'notes' : c.lecture_id ? 'lectures' : null
      const id = c.note_id ?? c.lecture_id
      if (table && id) {
        const { data } = await sb.from(table).select('id,title').eq('id', id).maybeSingle()
        setAttachedTitle((data as { title?: string } | null)?.title ?? null)
      }
    }).catch(() => router.push('/tutor'))
  }, [chatId, router])
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages, live])

  async function reload() { const m = await listMessages(supabase(), chatId); latest.current = m; setMessages(m) }

  async function send() {
    const message = text.trim()
    if (!message || live !== null) return
    setProblem(null); setText(''); setLive('')
    const shown = [...latest.current, { id: 'pending', chat_id: chatId, role: 'user' as const, content: message, sources: [], proposals: [], status: 'ok' as const, created_at: '' }]
    latest.current = shown; setMessages(shown)
    const r = await sendTutorMessage(chatId, message)
    if (!r.ok) {
      // Refused (limit, speed, offline): keep what was typed so it isn't lost
      setProblem({ code: r.error, message: r.message }); setText(message); setLive(null); await reload(); return
    }
    const cutOff = { code: 'cut_off', message: 'The reply was cut off. Try again.' }
    let ended = false
    try {
      for await (const l of r.lines) {
        if (l.t === 'delta') setLive(s => (s ?? '') + l.text)
        else if (l.t === 'done') ended = true
        else if (l.t === 'error') { ended = true; setProblem(l.messageId ? cutOff : { code: l.error, message: 'Couldn\'t reach the AI. Try again.' }) }
      }
      if (!ended) setProblem(cutOff) // the connection closed without finishing
    } catch { setProblem(cutOff) } finally {
      setLive(null)
      try { await reload(); setChat(await getChat(supabase(), chatId)) } catch { /* the next load shows it */ }
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

  async function rename() {
    const title = window.prompt('Chat name', chat!.title)?.trim()
    if (!title) return
    try { await renameChat(supabase(), chatId, title.slice(0, 200)); setChat(c => c && { ...c, title: title.slice(0, 200) }) } catch { toast('Couldn\'t rename.') }
  }
  async function remove() {
    if (!await confirm({ title: 'Delete this chat?', body: 'Its messages are deleted for good. Anything you added from it stays.', confirmLabel: 'Delete', danger: true })) return
    try { await deleteChat(supabase(), chatId); router.push('/tutor') } catch { toast('Couldn\'t delete the chat.') }
  }

  if (!chat) return <p className="text-sm text-muted">Loading…</p>
  const where = chat.note_id ? `/notes/${chat.note_id}` : chat.lecture_id ? `/lectures/${chat.lecture_id}` : null
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-medium">{chat.title}</h1>
        <select className="input max-w-40" aria-label="Course" value={chat.course_id ?? ''} onChange={e => { const v = e.target.value || null; setChat({ ...chat, course_id: v }); void setChatCourse(supabase(), chatId, v) }}>
          <option value="">No course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={rename}>Rename</button>
        <button type="button" className="btn-ghost text-danger" aria-label="Delete chat" onClick={remove}><Trash2 size={15} aria-hidden /></button>
      </div>
      {where && attachedTitle && <p className="text-xs text-muted">About <Link className="text-accent" href={where}>{attachedTitle}</Link></p>}

      <div className="space-y-3" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && live === null && <p className="card py-8 text-center text-sm text-muted">Ask anything. I&apos;ll start from your notes and say when I&apos;m going beyond them.</p>}
        {messages.map(m => m.role === 'user'
          ? <p key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-accent-soft px-3 py-2 text-sm">{m.content}</p>
          : (
            <div key={m.id} className="max-w-[95%] space-y-2">
              <MarkdownView source={m.content} />
              {m.status === 'cut_off' && <p className="text-xs text-muted">Reply was cut off. Try again.</p>}
              {m.sources.length > 0 && (
                <p className="text-xs text-muted">From: {m.sources.map((s, i) => (
                  <span key={s.id}>{i > 0 && ', '}<Link className="text-accent" href={SOURCE_LINK[s.kind](s.id)}>{s.title}</Link></span>
                ))}</p>
              )}
              {m.proposals.map(p => (
                <ProposalCard key={p.id} proposal={p} onAdd={e => add(m.id, e)} onDiscard={() => { change(m.id, p.id, { state: 'discarded' }).catch(() => toast('Couldn\'t save that.')) }} />
              ))}
            </div>
          ))}
        {live !== null && (live ? <MarkdownView source={live} /> : <p role="status" className="text-sm text-muted">Thinking…</p>)}
        <div ref={end} />
      </div>

      {problem && <AiError code={problem.code} message={problem.message} />}
      <form className="sticky bottom-0 flex gap-2 bg-bg pb-3 pt-1" onSubmit={e => { e.preventDefault(); void send() }}>
        <textarea className="input min-h-11 flex-1" rows={2} aria-label="Message" placeholder="Ask the tutor…" value={text} maxLength={4000}
          onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} />
        <button className="btn-primary self-end" disabled={!text.trim() || live !== null}>Send</button>
      </form>
    </div>
  )
}
