'use client'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type DropdownOption<T extends string = string> = { value: T; label: string; hint?: string; disabled?: boolean }

/** The usual course choice: none first (or another first option, such as "All courses"), then each course */
export const courseOptions = (courses: { id: string; name: string }[], first: DropdownOption | null = { value: '', label: 'No course' }): DropdownOption[] =>
  [...(first ? [first] : []), ...courses.map(c => ({ value: c.id, label: c.name }))]

const ROW = 40 // an option's height, to judge whether the list fits below
// A browser that can show a popover (some hide [popover] without being able to show it)
const canPopover = () => typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
const GAP_TO_EDGE = 12

/**
 * The app's dropdown, in place of the browser's: a solid button in the student's colour with the chosen option and a chevron,
 * opening into a list joined to it in the same colour, the options in lighter text and the chosen one ticked. It opens upward
 * when there is no room below. Keys: Enter, Space or the arrows open it; the arrows move, Home and End jump, Enter or Space
 * chooses, Escape or Tab closes, and typing a name jumps to it. The list is drawn in the top layer (a popover), so a dialog
 * or a scrolling card never cuts it off.
 */
export function Dropdown<T extends string>({ label, value, options, onChange, placeholder = 'Choose…', className = '', size = 'md', disabled, id }: {
  /** What it chooses, for screen readers (and the visible label's htmlFor, via id) */
  label: string
  value: T | ''
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  id?: string
}) {
  const auto = useId()
  const buttonId = id ?? `dd-${auto}`
  const listId = `${buttonId}-list`
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; up: boolean } | null>(null)
  const typed = useRef({ text: '', at: 0 })
  const chosen = options.findIndex(o => o.value === value)
  const current = chosen >= 0 ? options[chosen] : null
  const enabled = (i: number) => i >= 0 && i < options.length && !options[i].disabled

  const measure = useCallback(() => {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const want = Math.min(options.length * ROW + 8, 320)
    const below = window.innerHeight - r.bottom - GAP_TO_EDGE, above = r.top - GAP_TO_EDGE
    const up = below < want && above > below
    setPlace(up ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top, up } : { left: r.left, width: r.width, top: r.bottom, up })
  }, [options.length])

  function show(at: number) {
    if (disabled) return
    measure()
    setActive(enabled(at) ? at : options.findIndex((_, i) => enabled(i)))
    setOpen(true)
  }
  const close = useCallback((refocus = true) => { setOpen(false); if (refocus) button.current?.focus() }, [])
  function pick(i: number) {
    if (!enabled(i)) return
    if (options[i].value !== value) onChange(options[i].value)
    close()
  }

  // Shown in the top layer, above any dialog; kept beside its button. Browsers without popovers (and tests) draw it in place.
  useLayoutEffect(() => {
    const el = panel.current as (HTMLUListElement & { showPopover?: () => void }) | null
    if (open && el?.showPopover && !el.matches(':popover-open')) el.showPopover()
  }, [open, place])
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' }) }, [open, active])

  // A press anywhere else, the window resizing or the page scrolling (not the list itself) closes it
  useEffect(() => {
    if (!open) return
    const away = (e: Event) => { const t = e.target as Node; if (!panel.current?.contains(t) && !button.current?.contains(t)) close(false) }
    const scrolled = (e: Event) => { if (!panel.current?.contains(e.target as Node)) close(false) }
    const resized = () => close(false)
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('scroll', scrolled, true)
    window.addEventListener('resize', resized)
    return () => { document.removeEventListener('pointerdown', away, true); window.removeEventListener('scroll', scrolled, true); window.removeEventListener('resize', resized) }
  }, [open, close])

  function step(from: number, by: 1 | -1) {
    for (let i = from + by, n = 0; n < options.length; i += by, n++) {
      const k = (i + options.length) % options.length
      if (enabled(k)) return k
    }
    return from
  }
  // Typing jumps to the next option whose name starts with what was typed (letters typed quickly add up)
  function seek(key: string) {
    const now = Date.now()
    typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + key.toLowerCase(), at: now }
    const start = open ? active : chosen
    for (let n = 1; n <= options.length; n++) {
      const k = (Math.max(start, 0) + (typed.current.text.length > 1 ? n - 1 : n)) % options.length
      if (enabled(k) && options[k].label.toLowerCase().startsWith(typed.current.text)) return k
    }
    return -1
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = seek(e.key)
      if (k >= 0) { e.preventDefault(); if (open) setActive(k); else if (options[k].value !== value) onChange(options[k].value) }
      return
    }
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); show(e.key === 'ArrowUp' ? step(chosen, -1) : chosen) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => step(a, 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => step(a, -1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(step(-1, 1)) }
    else if (e.key === 'End') { e.preventDefault(); setActive(step(options.length, -1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
  }

  const pad = size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-[15px]'
  const joined = open && place ? (place.up ? 'rounded-t-none' : 'rounded-b-none') : ''
  // In the look's own colours, not the accent: the page's raised colour, its line and its ink, so a dropdown sits quietly in a form.
  // As wide as its choice needs (a page can give it a width); the list is at least as wide as the button.
  return (
    <div className={`relative inline-block min-w-36 max-w-full align-middle ${/(^|\s)w-/.test(className) ? '' : 'w-fit'} ${className}`}>
      <button ref={button} id={buttonId} type="button" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? close() : show(chosen))} onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-raised font-medium text-fg outline-none transition hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${open ? 'bg-surface' : ''} ${pad} ${joined}`}>
        <span className={`min-w-0 truncate text-left ${current ? '' : 'text-muted'}`}>{current?.label ?? placeholder}</span>
        <ChevronDown size={size === 'sm' ? 16 : 18} aria-hidden className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && place && (
        <ul ref={panel} id={listId} role="listbox" aria-label={label} popover={canPopover() ? 'manual' : undefined} tabIndex={-1}
          style={{ position: 'fixed', inset: 'auto', margin: 0, left: place.left, minWidth: place.width, maxWidth: `min(22rem, calc(100vw - ${place.left + 12}px))`, top: place.top, bottom: place.bottom }}
          className={`z-[60] max-h-80 overflow-y-auto border border-line bg-surface p-1 text-fg shadow-[0_14px_30px_-12px_rgb(0_0_0/0.35)] ${place.up ? 'rounded-t-xl rounded-br-xl border-b-0 pb-0' : 'rounded-b-xl rounded-tr-xl border-t-0 pt-0'}`}>
          {options.map((o, i) => {
            const on = o.value === value
            return (
              <li key={o.value} id={`${listId}-${i}`} data-index={i} role="option" aria-selected={on} aria-disabled={o.disabled || undefined}
                onPointerMove={() => { if (enabled(i)) setActive(i) }} onClick={() => pick(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 ${size === 'sm' ? 'py-1.5 text-sm' : 'py-2 text-[15px]'} ${o.disabled ? 'cursor-default opacity-40' : ''} ${i === active ? 'bg-raised text-fg' : on ? 'text-fg' : 'text-muted'}`}>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${on ? 'font-semibold' : ''}`}>{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-muted">{o.hint}</span>}
                </span>
                {on && <Check size={15} aria-hidden className="shrink-0" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
