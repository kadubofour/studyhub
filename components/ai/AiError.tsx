'use client'
import { LimitPrompt } from '@/components/billing/LimitPrompt'

export function AiError({ code, message }: { code: string; message: string }) {
  if (code === 'daily_limit' || code === 'fair_use' || code === 'premium_required') return <LimitPrompt kind={code} />
  return <p role="alert" className="text-sm text-danger">{message}</p>
}
