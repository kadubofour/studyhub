'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { announcePlanChanged } from './usePlan'

type State = 'checking' | 'credited' | 'pending' | 'failed' | 'error'
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Polls our confirm endpoint (which verifies with Paystack) until the payment settles or maxMs passes
export function ReturnStatus({ reference, pollMs = 3000, maxMs = 60_000 }: { reference: string; pollMs?: number; maxMs?: number }) {
  const [state, setState] = useState<State>('checking')
  const [until, setUntil] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout>
    let waited = 0 // counted in poll intervals, so it doesn't depend on the clock
    async function check() {
      try {
        const res = await fetch(`/api/billing/confirm?reference=${encodeURIComponent(reference)}`)
        const body = await res.json() as { state?: string; premiumUntil?: string | null }
        if (!live) return
        if (res.ok && body.state === 'credited') { setUntil(body.premiumUntil ?? null); setState('credited'); announcePlanChanged(); return }
        if (res.ok && body.state === 'failed') { setState('failed'); return }
        if (!res.ok && res.status !== 502) { setState('error'); return }
      } catch { /* keep trying */ }
      waited += pollMs
      if (waited >= maxMs) { setState('pending'); return }
      timer = setTimeout(check, pollMs)
    }
    check()
    return () => { live = false; clearTimeout(timer) }
  }, [reference, pollMs, maxMs])

  if (state === 'checking') return <p role="status">Confirming your payment…</p>
  if (state === 'credited') return <p role="status" className="text-lg font-medium">You&apos;re on Premium{until ? ` until ${fmt(until)}` : ''}. ✦</p>
  if (state === 'pending') return <p role="status">We&apos;ll switch you to Premium as soon as Paystack confirms. You can keep using Studyhub.</p>
  return (
    <div role="status" className="space-y-2">
      <p>{state === 'failed' ? 'Payment didn\'t go through. You haven\'t been charged.' : 'We couldn\'t check this payment. If you paid, Premium will switch on shortly.'}</p>
      <Link href="/plans" className="btn">Try again</Link>
    </div>
  )
}
