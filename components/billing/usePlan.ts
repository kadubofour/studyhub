'use client'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { FREE_DAILY_ACTIONS } from '@/lib/billing/plans'
import { AI_USED } from '@/components/ai/aiFetch'

export const PLAN_CHANGED = 'studyhub:plan-changed'
export const announcePlanChanged = () => { window.dispatchEvent(new Event(PLAN_CHANGED)) }
export const billingEnabled = () => process.env.NEXT_PUBLIC_BILLING_ENABLED === '1'

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))

export async function loadPlan(sb: SupabaseClient, now: Date) {
  const [{ data: ent }, { data: charges }] = await Promise.all([
    sb.from('entitlements').select('premium_until,auto_renew,card_brand,card_last4').maybeSingle(),
    sb.from('ai_charges').select('cost,at').gte('at', startOfUtcMonth(now).toISOString()),
  ])
  const premiumUntil = ent?.premium_until ? new Date(ent.premium_until) : null
  const day = startOfUtcDay(now).getTime()
  const rows = (charges ?? []) as { cost: number; at: string }[]
  const brand = ent?.card_brand ? ent.card_brand[0].toUpperCase() + ent.card_brand.slice(1) : null
  return {
    premiumUntil,
    isPremium: !!premiumUntil && premiumUntil.getTime() > now.getTime(),
    autoRenew: !!ent?.auto_renew,
    cardLabel: brand && ent?.card_last4 ? `${brand} •• ${ent.card_last4}` : null,
    usedToday: rows.filter(r => new Date(r.at).getTime() >= day).reduce((s, r) => s + r.cost, 0),
    usedThisMonth: rows.reduce((s, r) => s + r.cost, 0),
  }
}

export const freeAllowanceText = (usedToday: number) =>
  `${Math.max(0, FREE_DAILY_ACTIONS - usedToday)} of ${FREE_DAILY_ACTIONS} free AI actions left today`

type Plan = Awaited<ReturnType<typeof loadPlan>> & { loading: boolean; billing: boolean }
const EMPTY = { premiumUntil: null, isPremium: false, autoRenew: false, cardLabel: null, usedToday: 0, usedThisMonth: 0 }

// The signed-in student's plan and usage; refreshes after AI use or a plan change
export function usePlan(): Plan {
  const [plan, setPlan] = useState<Plan>({ ...EMPTY, loading: true, billing: billingEnabled() })
  useEffect(() => {
    let live = true
    const load = () => { loadPlan(supabase(), new Date()).then(p => { if (live) setPlan({ ...p, loading: false, billing: billingEnabled() }) }).catch(() => {}) }
    load()
    window.addEventListener(AI_USED, load); window.addEventListener(PLAN_CHANGED, load)
    return () => { live = false; window.removeEventListener(AI_USED, load); window.removeEventListener(PLAN_CHANGED, load) }
  }, [])
  return plan
}
