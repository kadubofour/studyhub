'use client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Hand, Maximize2, Mic, MicOff, Minimize2, Presentation, SendHorizontal, X } from 'lucide-react'
import { Orb } from '@/components/voice/Orb'
import { useLiveSession, type Phase } from '@/components/voice/useLiveSession'
import { LessonBoard } from '@/components/tutor/LessonPlayer'
import { Working } from '@/components/ui/Working'
import { useLockScroll } from '@/lib/ui/useLockScroll'

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

function Bars() {
  return <span aria-hidden className="live-bars">{[0, 1, 2, 3, 4].map(i => <i key={i} />)}</span>
}

function FullScreen({ session }: { session: Session }) {
  const { state, setFullscreen } = session
  const [typed, setTyped] = useState('')
  useLockScroll() // the Tutor page behind the screen stays where it was
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setFullscreen])
  const board = state.visual && state.script
  const sending = state.phase === 'listening' && state.you.trim().length > 0
  return (
    <div role="dialog" aria-modal="true" aria-label="Live session with the tutor" data-testid="live-full" data-phase={state.phase}
      className="live-stage fixed inset-0 z-[80] flex flex-col overscroll-contain pb-[env(safe-area-inset-bottom)] pt-[calc(env(safe-area-inset-top)+1rem)] md:pt-[env(safe-area-inset-top)]">
      {/* the focus screen's slow drift, in the student's two colours */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="chill-blob chill-a" style={{ width: '46vmax', height: '46vmax', left: '-12vmax', top: '-14vmax', background: 'var(--accent-solid)' }} />
        <span className="chill-blob chill-b" style={{ width: '40vmax', height: '40vmax', right: '-12vmax', bottom: '-10vmax', background: 'var(--accent-glow)' }} />
        <span className="chill-blob chill-c" style={{ width: '30vmax', height: '30vmax', left: '30%', top: '40%', background: 'var(--accent-glow)' }} />
      </div>

      <header className="relative flex items-center gap-2 px-4 py-3">
        {/* only a dot says a session is on, and what it is doing */}
        <div role="status" aria-label={`Live session: ${state.muted ? 'microphone off' : STATUS[state.phase]}`} title={state.muted ? 'Microphone off' : STATUS[state.phase]}
          className="live-glass mr-auto grid size-9 place-items-center rounded-full">
          <span aria-hidden className={`size-2.5 rounded-full ${state.muted ? 'bg-muted' : 'bg-[var(--accent-glow)]'} ${!state.muted && (state.phase === 'listening' || state.phase === 'speaking') ? 'animate-pulse' : ''}`} />
        </div>
        <button type="button" role="switch" aria-checked={state.visual} aria-label="Visual explanation" title={state.visual ? 'Visual explanations on' : 'Visual explanations off'}
          className={`live-glass grid size-9 place-items-center rounded-full ${state.visual ? 'text-[var(--accent-glow)]' : 'text-muted'}`} onClick={() => session.setVisual(!state.visual)}>
          <Presentation size={16} aria-hidden />
        </button>
        <button type="button" aria-label="Use the app" title="Keep going while you use the rest of the app" className="live-glass grid size-9 place-items-center rounded-full text-muted" onClick={() => setFullscreen(false)}><Minimize2 size={16} aria-hidden /></button>
        <button type="button" aria-label="End the session" title="End" className="live-glass grid size-9 place-items-center rounded-full text-danger" onClick={session.end}><X size={16} aria-hidden /></button>
      </header>

      <main className="no-bar relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(.5rem,2.5dvh,1.5rem)] overflow-y-auto px-4 py-2">
        {board ? (
          <div className="relative w-full max-w-4xl">
            <LessonBoard script={state.script!} step={state.step} className="live-glass block h-auto max-h-[48dvh] w-full rounded-3xl" />
            <div className="absolute bottom-3 right-3"><div className="live-orb" data-phase={state.phase} data-muted={state.muted}><Orb phase={state.phase} muted={state.muted} size={56} /></div></div>
          </div>
        ) : state.visual && state.phase === 'drawing' ? (
          <div className="grid place-items-center gap-4 text-muted"><div className="live-orb" data-phase={state.phase} data-muted={state.muted}><Orb phase={state.phase} muted={state.muted} size="min(128px, 18dvh)" /></div><Working kind="think" size="sm" label="Drawing it" className="text-sm" /></div>
        ) : (
          <div className="grid place-items-center gap-5">
            <div className="live-orb" data-phase={state.phase} data-muted={state.muted}><Orb phase={state.phase} muted={state.muted} size={state.visual ? 'min(128px, 18dvh)' : 'min(208px, 28dvh)'} /></div>
            <Bars />
          </div>
        )}

        <div className="live-glass w-full max-w-2xl rounded-3xl px-6 py-5 text-center" aria-live="polite">
          {state.tutor
            ? <p className="no-bar max-h-[22dvh] overflow-y-auto text-lg leading-relaxed sm:text-xl">{state.tutor}</p>
            : state.phase === 'listening' && !state.you && !state.error ? <p className="text-muted">{state.supported ? 'Go ahead, ask me anything.' : 'Voice needs Chrome, Edge or Safari. You can type your question below.'}</p> : null}
          {state.you && <p className="mt-2 text-sm italic text-muted">You: {state.you}</p>}
          {state.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
        </div>
      </main>

      <footer className="relative px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 max-md:pb-6">
        <div className="live-glass mx-auto flex max-w-xl items-center gap-2 rounded-full p-2">
          <button type="button" aria-label={state.muted ? 'Turn the microphone on' : 'Mute the microphone'} aria-pressed={state.muted} title={state.muted ? 'Unmute' : 'Mute'}
            className={`grid size-11 shrink-0 place-items-center rounded-full border border-line bg-raised ${state.muted ? '!bg-danger-soft text-danger' : ''}`} onClick={() => session.mute(!state.muted)}>
            {state.muted ? <MicOff size={19} aria-hidden /> : <Mic size={19} aria-hidden />}
          </button>
          <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={e => { e.preventDefault(); const t = typed.trim(); if (t) { setTyped(''); session.type(t) } }}>
            <input aria-label="Type a question" className="input min-w-0 flex-1 !rounded-full !border-transparent !bg-transparent" placeholder="Type a question" maxLength={1000} value={typed} onChange={e => setTyped(e.target.value)} />
            <button aria-label="Send" title="Send" className="grid size-9 shrink-0 place-items-center rounded-full text-muted disabled:opacity-40" disabled={!typed.trim()}><SendHorizontal size={17} aria-hidden /></button>
          </form>
          <button type="button" aria-label={sending ? 'Send what you said' : 'Ask a question'} title={sending ? 'Send' : 'Ask a question'} autoFocus
            className="btn-primary grid size-11 shrink-0 place-items-center !rounded-full !p-0" onClick={session.ask}>
            {sending ? <SendHorizontal size={19} aria-hidden /> : <Hand size={19} aria-hidden />}
          </button>
        </div>
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

