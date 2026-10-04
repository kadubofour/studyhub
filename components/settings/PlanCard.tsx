'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { announcePlanChanged, billingEnabled, usePlan } from '@/components/billing/usePlan'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { FAIR_USE_MONTHLY_ACTIONS, PRODUCTS, formatGhs, type ProductId } from '@/lib/billing/plans'

type Payment = { id: string; product: ProductId; amount_minor: number; channel: string; status: string; paid_at: string | null; created_at: string }
const date = (iso: string, withYear = true) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
const CHANNEL: Record<string, string> = { mobile_money: 'MoMo', card: 'Card', other: 'Other' }
const STATUS: Record<string, string> = { success: '✓', failed: 'failed', refunded: 'refunded', needs_review: 'being checked' }

export function PlanCard() {
  const plan = usePlan()
  const confirm = useConfirm()
  const [payments, setPayments] = useState<Payment[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!billingEnabled()) return
    supabase().from('payments').select('id,product,amount_minor,channel,status,paid_at,created_at').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setPayments((data ?? []) as Payment[]))
  }, [])
  if (!plan.billing || plan.loading) return null

  async function cancel() {
    if (!await confirm({ title: 'Turn off renewal?', body: `Premium stays on until ${date(plan.premiumUntil!.toISOString())}, then you'll be on Free.`, confirmLabel: 'Turn off' })) return
    const res = await fetch('/api/billing/cancel-renewal', { method: 'POST' })
    if (res.ok) announcePlanChanged()
    else setError('Couldn\'t turn off renewal. Try again or contact support.')
  }

  return (
    <section className="card space-y-3">
      <h2 className="text-base font-semibold">Plan</h2>
      {plan.isPremium ? (
        <div className="space-y-1 text-sm">
          <p><b>✦ Premium</b> <span className="text-muted">until {date(plan.premiumUntil!.toISOString())}</span></p>
          {plan.autoRenew
            ? <p className="text-muted">Renews automatically{plan.cardLabel ? ` (${plan.cardLabel})` : ''} · <button type="button" className="text-danger" onClick={cancel}>Turn off renewal</button></p>
            : <p className="text-muted">Ends on {date(plan.premiumUntil!.toISOString())}</p>}
          <p>This month: {plan.usedThisMonth} of {FAIR_USE_MONTHLY_ACTIONS} AI actions</p>
          <Link href="/plans" className="btn mt-1">Add more time</Link>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p><b>Free</b></p>
          <Link href="/plans" className="btn-primary">✦ Get Premium</Link>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {payments.length > 0 && (
        <div>
          <h3 className="section-label">Payments</h3>
          <ul className="space-y-0.5 text-sm text-muted">
            {payments.map(p => (
              <li key={p.id}>{date(p.paid_at ?? p.created_at)} · {PRODUCTS[p.product]?.label.replace(' (renewal)', '') ?? p.product} · {formatGhs(p.amount_minor)} · {CHANNEL[p.channel] ?? p.channel} {STATUS[p.status] ?? p.status}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
