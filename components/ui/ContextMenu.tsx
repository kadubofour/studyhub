'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { TableGridPicker } from '@/components/notes/TableGridPicker'

export type MenuEntry =
  | { label: string; icon: LucideIcon; onSelect: () => void; shortcut?: string; danger?: boolean; disabled?: boolean }
  | { label: string; icon: LucideIcon; onPickTable: (rows: number, cols: number) => void; disabled?: boolean }
  | 'sep'

/**
 * Right-click (or long-press) quick-actions menu, drawn at the pointer and kept on screen.
 * Arrow keys move, Enter chooses, Esc / clicking elsewhere / scrolling closes it.
 */
export function ContextMenu({ x, y, items, label, onClose, footer }: {
  x: number; y: number; items: MenuEntry[]; label: string; onClose: () => void; footer?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [gridOpen, setGridOpen] = useState(false)
  const enabled = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])

  // Keep the menu inside the window: flip left/up when it would run off the edge
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (x + width > window.innerWidth - 8) el.style.left = `${Math.max(8, x - width)}px`
    if (y + height > window.innerHeight - 8) el.style.top = `${Math.max(8, y - height)}px`
  }, [x, y, gridOpen])

  useEffect(() => {
    const menu = ref.current
    const before = document.activeElement as HTMLElement | null
    enabled()[0]?.focus()
    const outside = (e: Event) => { if (!menu?.contains(e.target as Node)) onClose() }
    const away = () => onClose()
    document.addEventListener('mousedown', outside)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    window.addEventListener('blur', away)
    return () => {
      document.removeEventListener('mousedown', outside)
      window.removeEventListener('scroll', away, true)
      window.removeEventListener('resize', away)
      window.removeEventListener('blur', away)
      // Give focus back (e.g. to the editor) unless the student clicked somewhere else.
      // An open modal dialog makes the page inert, so this can't steal focus from it.
      const now = document.activeElement
      if (!now || now === document.body || menu?.contains(now)) before?.focus({ preventScroll: true })
    }
  }, [onClose])

  function onKey(e: React.KeyboardEvent) {
    const list = enabled()
    const at = list.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => { e.preventDefault(); setGridOpen(false); list[(n + list.length) % list.length]?.focus() }
    switch (e.key) {
      case 'ArrowDown': return go(at + 1)
      case 'ArrowUp': return go(at - 1)
      case 'Home': return go(0)
      case 'End': return go(list.length - 1)
      case 'Escape': e.preventDefault(); e.stopPropagation(); onClose(); return
      case 'Tab': e.preventDefault(); onClose()
    }
  }

  return createPortal(
    <div ref={ref} role="menu" aria-label={label} className="menu-panel fixed mt-0" style={{ left: x, top: y }}
      onKeyDown={onKey} onContextMenu={e => e.preventDefault()}>
      {items.map((entry, i) => entry === 'sep' ? <div key={i} role="separator" className="menu-sep" /> : (
        <div key={entry.label}>
          <button type="button" role="menuitem" tabIndex={-1} aria-disabled={entry.disabled || undefined}
            aria-haspopup={'onPickTable' in entry ? 'true' : undefined}
            aria-expanded={'onPickTable' in entry ? gridOpen : undefined}
            className={`menu-item ${'danger' in entry && entry.danger ? 'danger' : ''}`}
            onClick={() => {
              if (entry.disabled) return
              if ('onPickTable' in entry) { setGridOpen(g => !g); return }
              onClose(); entry.onSelect()
            }}
            onKeyDown={e => { if ('onPickTable' in entry && e.key === 'ArrowRight' && !entry.disabled) { e.preventDefault(); setGridOpen(true) } }}>
            <span className="menu-icon"><entry.icon size={15} aria-hidden /></span>
            <span className="flex-1">{entry.label}</span>
            {'shortcut' in entry && entry.shortcut && <kbd className="menu-kbd">{entry.shortcut}</kbd>}
            {'onPickTable' in entry && <ChevronRight size={15} className={`ml-auto mr-1 text-muted transition-transform ${gridOpen ? 'rotate-90' : ''}`} aria-hidden />}
          </button>
          {'onPickTable' in entry && gridOpen && (
            <div className="mx-1 mb-1 mt-0.5 flex justify-center rounded-xl bg-surface">
              <TableGridPicker autoFocus onPick={(r, c) => { onClose(); entry.onPickTable(r, c) }} onCancel={() => setGridOpen(false)} />
            </div>
          )}
        </div>
      ))}
      {footer && <p className="mx-2 mb-0.5 mt-1.5 border-t border-line pt-1.5 text-[11px] text-muted [@media(pointer:coarse)]:hidden">{footer}</p>}
    </div>,
    document.body,
  )
}
