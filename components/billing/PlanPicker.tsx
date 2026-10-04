'use client'
import { useState } from 'react'
import { CHOICES, FAIR_USE_MONTHLY_ACTIONS, FAIR_USE_TRANSCRIPT_HOURS, FREE_DAILY_ACTIONS, PRODUCTS, formatGhs, type CheckoutChoice } from '@/lib/billing/plans'

const ORDER: CheckoutChoice[] = ['1m', '3m', '12m']

export function PlanPicker({ go = url => window.location.assign(url) }: { go?: (url: string) => void }) {
  const [choice, setChoice] = useState<CheckoutChoice>('1m')
  const [autoRenew, setAutoRenew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canRenew = !!CHOICES[choice].renew
  const price = PRODUCTS[CHOICES[choice].pass].amountMinor

  async function pay() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice, autoRenew: canRenew && autoRenew }) })
      const body = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (res.ok && body.url) { go(body.url); return }
      setError(body.error === 'email_unconfirmed' ? 'Confirm your email address first, then try again.' : 'Couldn\'t start checkout. Try again.')
    } catch { setError('Couldn\'t start checkout. Try again.') }
    setBusy(false)
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1.3fr]">
      <section className="card">
        <h2 className="font-semibold">Free</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Every feature</li><li>{FREE_DAILY_ACTIONS} AI actions a day</li><li>Free live lecture transcripts</li>
        </ul>
      </section>
      <section className="card border-2 border-accent">
        <h2 className="font-semibold">✦ Premium</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li>Unlimited AI*</li><li>Accurate lecture transcripts</li></ul>
        <fieldset className="mt-3 space-y-1.5 text-sm"><legend className="sr-only">Length</legend>
          {ORDER.map(c => (
            <label key={c} className="flex items-center gap-2">
              <input type="radio" name="choice" checked={choice === c} onChange={() => setChoice(c)} />
              {PRODUCTS[CHOICES[c].pass].label} · <b>{formatGhs(PRODUCTS[CHOICES[c].pass].amountMinor)}</b>
              {CHOICES[c].save && <span className="text-success">{CHOICES[c].save}</span>}
            </label>
          ))}
        </fieldset>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={canRenew && autoRenew} disabled={!canRenew} onChange={e => setAutoRenew(e.target.checked)} />
          Renew automatically (card only)
        </label>
        <button type="button" className="btn-primary mt-3" disabled={busy} onClick={pay}>{busy ? 'Opening Paystack…' : `Pay ${formatGhs(price)} with Paystack`}</button>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">MoMo or card. *Fair use: {FAIR_USE_MONTHLY_ACTIONS} AI actions &amp; {FAIR_USE_TRANSCRIPT_HOURS} h transcripts a month.</p>
      </section>
    </div>
  )
}
