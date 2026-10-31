'use client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Hand, Maximize2, Mic, MicOff, Minimize2, SendHorizontal, X } from 'lucide-react'
import { Orb } from '@/components/voice/Orb'
import { useLiveSession, type LiveState, type Phase } from '@/components/voice/useLiveSession'
import { LessonBoard } from '@/components/tutor/LessonPlayer'
import { Switch } from '@/components/ui/Switch'
import { Working } from '@/components/ui/Working'

// The live tutor lives in the app's layout, so a session carries on while the student goes to another page: full screen, or shrunk to a small bar.

type Live = { start: (chatId: string) => void; active: boolean; chatId: string | null }
const Ctx = createContext<Live>({ start: () => {}, active: false, chatId: null })
export const useLiveTutor = () => useContext(Ctx)

const STATUS: Record<Phase, string> = { listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', drawing: 'Drawing it' }

export function LiveTutorProvider({ children }: { children: React.ReactNode }) {
  const session = useLiveSession()
  const { state } = session
  const value = useMemo<Live>(() => ({ start: session.start, active: state.active, chatId: state.chatId }), [session.start, state.active, state.chatId])
  return (
    <Ctx.Provider value={value}>
      {children}
      {state.active && (state.fullscreen ? <FullScreen session={session} /> : <Mini session={session} />)}
    </Ctx.Provider>
  )
}

type Session = ReturnType<typeof useLiveSession>

function Controls({ state, session }: { state: LiveState; session: Session }) {
  const sending = state.phase === 'listening' && state.you.trim().length > 0
  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" aria-label={state.muted ? 'Turn the microphone on' : 'Mute the microphone'} aria-pressed={state.muted} title={state.muted ? 'Unmute' : 'Mute'}
        className={`btn grid size-12 place-items-center !rounded-full !p-0 ${state.muted ? '!bg-danger-soft text-danger' : ''}`} onClick={() => session.mute(!state.muted)}>
        {state.muted ? <MicOff size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
      </button>
      <button type="button" className="btn-primary !px-6 !py-3 text-base" onClick={session.ask} autoFocus>
        {sending ? <SendHorizontal size={18} aria-hidden /> : <Hand size={18} aria-hidden />}{sending ? 'Send' : 'Ask a question'}
      </button>
    </div>
  )
}

function FullScreen({ session }: { session: Session }) {
  const { state, setFullscreen } = session
  const [typed, setTyped] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setFullscreen])
  const board = state.visual && state.script
  return (
    <div role="dialog" aria-modal="true" aria-label="Live session with the tutor" data-testid="live-full"
      className="fixed inset-0 z-[80] flex flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="mr-auto min-w-0">
          <h2 className="text-base font-semibold">Live session</h2>
          <p role="status" className="text-xs text-muted">{state.muted ? 'Microphone off' : STATUS[state.phase]}</p>
        </div>
        <span className="flex items-center gap-2 text-sm">
          <span id="live-visual-label">Visual explanation</span>
          <Switch checked={state.visual} onChange={session.setVisual} labelledBy="live-visual-label" />
        </span>
        <button type="button" className="btn" onClick={() => setFullscreen(false)} title="Keep going while you use the rest of the app"><Minimize2 size={15} aria-hidden />Use the app</button>
        <button type="button" className="btn text-danger" onClick={session.end}><X size={15} aria-hidden />End</button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-4 py-2">
        {board ? (
          <div className="relative w-full max-w-4xl">
            <LessonBoard script={state.script!} step={state.step} className="block h-auto max-h-[56dvh] w-full rounded-2xl border border-line bg-raised" />
            <div className="absolute bottom-3 right-3"><Orb phase={state.phase} muted={state.muted} size={56} /></div>
          </div>
        ) : state.visual && state.phase === 'drawing' ? (
          <div className="grid place-items-center gap-3 text-muted"><Orb phase={state.phase} muted={state.muted} size={120} /><Working kind="think" size="sm" label="Drawing it" className="text-sm" /></div>
        ) : (
          <Orb phase={state.phase} muted={state.muted} size={state.visual ? 120 : 200} />
        )}

        <div className="w-full max-w-2xl text-center" aria-live="polite">
          {state.tutor
            ? <p className="max-h-[22dvh] overflow-y-auto text-lg leading-relaxed sm:text-xl">{state.tutor}</p>
            : state.phase === 'listening' && !state.you && !state.error && <p className="text-muted">{state.supported ? 'Go ahead, ask me anything.' : 'Voice needs Chrome, Edge or Safari. You can type your question below.'}</p>}
          {state.you && <p className="mt-2 text-sm italic text-muted">You: {state.you}</p>}
          {state.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
        </div>
      </main>

      <footer className="space-y-3 px-4 pb-4 pt-2">
        <Controls state={state} session={session} />
        <form className="mx-auto flex max-w-xl gap-2" onSubmit={e => { e.preventDefault(); const t = typed.trim(); if (t) { setTyped(''); session.type(t) } }}>
          <input aria-label="Type a question" className="input min-w-0 flex-1" placeholder="Or type a question" maxLength={1000} value={typed} onChange={e => setTyped(e.target.value)} />
          <button className="btn" disabled={!typed.trim()}>Send</button>
        </form>
      </footer>
    </div>
  )
}

function Mini({ session }: { session: Session }) {
  const { state } = session
  return (
    <section aria-label="Live session with the tutor" data-testid="live-mini"
      className="fixed bottom-4 right-4 z-[70] flex max-w-[min(26rem,calc(100vw-1.5rem))] items-center gap-3 rounded-2xl border border-line bg-raised p-2.5 pr-3 shadow-xl max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))] max-md:right-3">
      <Orb phase={state.phase} muted={state.muted} size={44} />
      <div className="min-w-0 flex-1">
        <p role="status" className="text-sm font-medium">{state.muted ? 'Microphone off' : STATUS[state.phase]}</p>
        <p className="max-w-52 truncate text-xs text-muted">{state.tutor || state.you || 'Live session'}</p>
      </div>
      <button type="button" aria-label={state.muted ? 'Turn the microphone on' : 'Mute the microphone'} aria-pressed={state.muted} title={state.muted ? 'Unmute' : 'Mute'}
        className={`btn-ghost grid size-9 place-items-center !rounded-full !p-0 ${state.muted ? 'text-danger' : ''}`} onClick={() => session.mute(!state.muted)}>
        {state.muted ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
      </button>
      <button type="button" aria-label="Ask a question" title="Ask a question" className="btn-ghost grid size-9 place-items-center !rounded-full !p-0" onClick={session.ask}><Hand size={16} aria-hidden /></button>
      <button type="button" aria-label="Full screen" title="Full screen" className="btn-ghost grid size-9 place-items-center !rounded-full !p-0" onClick={() => session.setFullscreen(true)}><Maximize2 size={16} aria-hidden /></button>
      <button type="button" aria-label="End the session" title="End" className="btn-ghost grid size-9 place-items-center !rounded-full !p-0 text-danger" onClick={session.end}><X size={16} aria-hidden /></button>
    </section>
  )
}

