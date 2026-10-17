'use client'
import { useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { useDictation } from '@/components/tutor/useDictation'

// Where a student writes the answer to a flashcard from memory. Enter checks it; "I don't know" shows the answer without marking anything.
export function TypedAnswer({ onCheck, onSkip }: { onCheck: (typed: string) => void; onSkip: () => void }) {
  const [text, setText] = useState('')
  const base = useRef('') // what was in the box when dictation began
  const dictation = useDictation(spoken => {
    const said = spoken.trim()
    setText((said ? `${base.current}${base.current ? ' ' : ''}${said}` : base.current).slice(0, 2000))
  })
  const check = () => { if (text.trim()) { dictation.stop(); onCheck(text) } }
  return (
    <div className="w-full space-y-3 text-left">
      <textarea aria-label="Your answer" className="input min-h-24 w-full resize-y" placeholder="Type what you remember…" value={text} maxLength={2000} autoFocus
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); check() } }} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn-primary min-w-28" disabled={!text.trim()} onClick={check}>Check</button>
        <button type="button" className="btn" onClick={() => { dictation.stop(); onSkip() }}>I don&apos;t know</button>
        {dictation.supported && (
          <button type="button" aria-label={dictation.listening ? 'Stop dictating' : 'Dictate'} aria-pressed={dictation.listening} title={dictation.listening ? 'Stop dictating' : 'Dictate'}
            className={`btn-ghost grid size-10 place-items-center !rounded-full !p-0 ${dictation.listening ? '!bg-accent-soft text-accent motion-safe:animate-pulse' : 'text-muted'}`}
            onClick={() => { if (dictation.listening) dictation.stop(); else { base.current = text.trimEnd(); dictation.start() } }}><Mic size={18} aria-hidden /></button>
        )}
      </div>
    </div>
  )
}
