'use client'
import Link from 'next/link'
import { usePlan } from './usePlan'

export function endingSoon(p: { isPremium: boolean; autoRenew: boolean; premiumUntil: Date | null }, now: Date) {
  if (!p.isPremium || p.autoRenew || !p.premiumUntil) return null
  const days = Math.ceil((p.premiumUntil.getTime() - now.getTime()) / 86_400_000)
  if (days !== 7 && days > 1) return null // reminders 7 days and 1 day before, as agreed
  return { days, date: p.premiumUntil.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) }
}

export function EndingBanner() {
  const plan = usePlan()
  const soon = plan.billing ? endingSoon(plan, new Date()) : null
  if (!soon) return null
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
      <span>Premium ends on {soon.date}.</span>
      <Link href="/plans" className="font-medium text-accent">Renew</Link>
    </div>
  )
}
