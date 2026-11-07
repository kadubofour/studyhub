'use client'
import { useEffect, useRef } from 'react'
import { BarChart3, ListChecks, Mic, Settings, Timer, Trophy, type LucideIcon } from 'lucide-react'

// The places the phone dock has no room for. Opens above the dock as a sheet, like Create.
export const MORE_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/lectures', label: 'Lectures', icon: Mic },
  { href: '/quiz', label: 'Quizzes', icon: ListChecks },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function MoreMenu({ onGo, onClose }: { onGo: (href: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    // the dock button that opened it toggles it, so a press on the dock is left to that button
    const away = (e: PointerEvent) => { const t = e.target as Element; if (ref.current && !ref.current.contains(t) && !t.closest('[data-more-button]')) onClose() }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [onClose])
  const move = (e: React.KeyboardEvent) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
  }
  return (
    <>
      <div aria-hidden className="create-in fixed inset-0 z-40 bg-black/45" />
      <div ref={ref} role="menu" aria-label="More" onKeyDown={move} style={{ background: 'var(--glass-strong)' }}
        className="create-in fixed inset-x-3 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-50 mx-auto grid max-w-md grid-cols-2 gap-2 min-[400px]:grid-cols-3 rounded-3xl border border-line p-3 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.45)]">
        {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
          <button key={href} type="button" role="menuitem" onClick={() => { onClose(); onGo(href) }}
            className="flex min-h-20 flex-col items-start justify-between gap-2 rounded-2xl bg-surface p-2.5 text-left outline-none transition active:scale-[.98] focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]">
            <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-raised text-accent"><Icon size={18} /></span>
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
