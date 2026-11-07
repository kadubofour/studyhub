'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessagesSquare } from 'lucide-react'
import type { Editor } from '@tiptap/core'

// A small "Ask the tutor" button that appears by text selected in the note: one press asks the tutor to explain exactly that passage.
// It sits above the selection on a computer, and below it on a phone, where the browser's own selection menu is above.
export const MIN_SELECTED = 3 // characters (not counting spaces): a stray letter is not a passage

export function selectedPassage(editor: Editor): string {
  const { from, to, empty } = editor.state.selection
  if (empty) return ''
  const text = editor.state.doc.textBetween(from, to, '\n', ' ').trim()
  return text.replace(/\s/g, '').length >= MIN_SELECTED ? text : ''
}

export function ExplainBubble({ editor, onExplain, below = false, hidden = false }: { editor: Editor; onExplain: (text: string) => void; below?: boolean; hidden?: boolean }) {
  const [at, setAt] = useState<null | { x: number; y: number; text: string }>(null)

  useEffect(() => {
    let frame = 0
    const place = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const text = selectedPassage(editor)
        if (!text) { setAt(null); return }
        try {
          const { from, to } = editor.state.selection
          const a = editor.view.coordsAtPos(from), b = editor.view.coordsAtPos(to)
          const x = Math.min(window.innerWidth - 80, Math.max(80, (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2))
          setAt({ x, y: below ? Math.max(a.bottom, b.bottom) + 10 : Math.min(a.top, b.top) - 10, text })
        } catch { setAt(null) }
      })
    }
    editor.on('selectionUpdate', place); editor.on('update', place)
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(frame)
      editor.off('selectionUpdate', place); editor.off('update', place)
      window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place)
    }
  }, [editor, below])

  if (!at || hidden) return null
  return createPortal(
    // pressing it must not move the selection or close the keyboard, so the press is not allowed to reach the note
    <button type="button" data-explain-bubble onMouseDown={e => e.preventDefault()} onPointerDown={e => { if (e.pointerType !== 'mouse') e.preventDefault() }}
      onClick={() => onExplain(at.text)} aria-label="Ask the tutor to explain the selected text"
      style={{ left: at.x, top: at.y }}
      className={`fixed z-50 inline-flex -translate-x-1/2 ${below ? '' : '-translate-y-full'} items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-raised px-3.5 py-2 text-sm font-medium text-accent shadow-lg transition hover:bg-surface pointer-coarse:py-2.5`}>
      <MessagesSquare size={15} aria-hidden />Explain
    </button>,
    document.body,
  )
}
