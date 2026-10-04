'use client'
import { usePlan } from './usePlan'

export function PremiumBadge() {
  const plan = usePlan()
  if (!plan.billing || !plan.isPremium) return null
  return <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent" title="Premium">✦ Premium</span>
}
