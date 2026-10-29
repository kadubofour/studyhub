'use client'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { BTN_OUTLINE } from '@/components/ui/buttonStyles'

export type QuickAction = { label: string; icon?: LucideIcon; href?: string; onClick?: () => void } | { node: React.ReactNode }

// A row of the things a student does most, one tap away, as the look's outline buttons like every page header's secondary actions. Actions can be links, buttons, or any element (such as the New note button).
export function QuickActions({ label, actions, className = '' }: { label: string; actions: QuickAction[]; className?: string }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap items-center gap-2 ${className}`}>
      {actions.map((a, i) => {
        if ('node' in a) return <span key={i} className="contents">{a.node}</span>
        const Icon = a.icon
        const inner = <>{Icon && <Icon size={15} aria-hidden />}{a.label}</>
        return a.href
          ? <Link key={a.label} href={a.href} className={BTN_OUTLINE}>{inner}</Link>
          : <button key={a.label} type="button" className={BTN_OUTLINE} onClick={a.onClick}>{inner}</button>
      })}
    </div>
  )
}
