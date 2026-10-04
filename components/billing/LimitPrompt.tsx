'use client'
import Link from 'next/link'
import { FREE_DAILY_ACTIONS, PRODUCTS, formatGhs } from '@/lib/billing/plans'
import { billingEnabled } from './usePlan'

function resetIn(now: Date) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  const mins = Math.max(1, Math.ceil((next - now.getTime()) / 60_000))
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const TEXT = {
  daily_limit: { title: `You've used today's ${FREE_DAILY_ACTIONS} free AI actions`, body: () => `They reset in ${resetIn(new Date())}. Premium has no daily limit.`, upgrade: true },
  fair_use: { title: 'You\'ve reached fair use for this month', body: () => 'Premium AI comes back on the 1st. Everything else keeps working.', upgrade: false },
  premium_required: { title: 'This is a Premium feature', body: () => 'Premium includes accurate lecture transcripts and unlimited AI.', upgrade: true },
} as const

// `title` replaces the standard heading when the caller knows more (e.g. a PDF that costs more than is left)
export function LimitPrompt({ kind, title }: { kind: keyof typeof TEXT; title?: string }) {
  const t = TEXT[kind]
  return (
    <div role="status" className="rounded-xl bg-accent-soft p-3 text-sm">
      <p className="font-medium">{title ?? t.title}</p>
      <p className="mt-0.5 text-xs text-muted">{t.body()}</p>
      {t.upgrade && billingEnabled() && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link href="/plans" className="btn-primary">✦ Get Premium · {formatGhs(PRODUCTS.pass_1m.amountMinor)}/month</Link>
          <Link href="/plans" className="text-xs text-accent">See plans</Link>
        </div>
      )}
    </div>
  )
}
