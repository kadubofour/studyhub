'use client'
import { useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { useDictation } from '@/components/tutor/useDictation'

// Where a student writes the answer to a flashcard from memory: one line, Enter (or Check) marks it. "Show answer" gives up without marking anything.
export function TypedAnswer({ onCheck, onSkip }: { onCheck: (typed: string) => void; onSkip: () => void }) {
  const [text, setText] = useState('')
  const base = useRef('') // what was in the box when dictation began
  const dictation = useDictation(spoken => {
    const said = spoken.trim()
    setText((said ? `${base.current}${base.current ? ' ' : ''}${said}` : base.current).slice(0, 500))
  })
  const check = () => { if (text.trim()) { dictation.stop(); onCheck(text) } }
  return (
    <form className="w-full space-y-2" onSubmit={e => { e.preventDefault(); check() }}>
      <div className="flex items-center gap-2">
        <input aria-label="Your answer" className="input min-w-0 flex-1" placeholder="Type your answer" autoComplete="off" value={text} maxLength={500} autoFocus
          onChange={e => setText(e.target.value)} />
        {dictation.supported && (
          <button type="button" aria-label={dictation.listening ? 'Stop dictating' : 'Dictate'} aria-pressed={dictation.listening} title={dictation.listening ? 'Stop dictating' : 'Dictate'}
            className={`btn-ghost grid size-10 shrink-0 place-items-center !rounded-full !p-0 ${dictation.listening ? '!bg-accent-soft text-accent motion-safe:animate-pulse' : 'text-muted'}`}
            onClick={() => { if (dictation.listening) dictation.stop(); else { base.current = text.trimEnd(); dictation.start() } }}><Mic size={18} aria-hidden /></button>
        )}
        <button className="btn-primary" disabled={!text.trim()}>Check</button>
      </div>
      <button type="button" className="text-xs text-muted underline underline-offset-2 hover:text-fg" onClick={() => { dictation.stop(); onSkip() }}>Show answer</button>
    </form>
  )
}
