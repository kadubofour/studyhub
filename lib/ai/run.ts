import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { AiEmptyError, AiIncompleteError, AiRefusedError, isAiConfigured, openai, type AiClient } from './openai'

export type AiErrorCode = 'ai_unavailable' | 'rate_limited' | 'daily_limit' | 'fair_use' | 'busy' | 'refused' | 'too_long' | 'empty' | 'ai_failed' | 'aborted'
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiErrorCode }

const STATUS: Record<AiErrorCode, number> = {
  ai_unavailable: 503, rate_limited: 429, daily_limit: 402, fair_use: 402, busy: 429,
  refused: 422, too_long: 413, empty: 422, ai_failed: 502, aborted: 499,
}

// Every AI feature goes through here: the plan check (speed limit, Free daily limit or Premium fair
// use) reserves the cost before the call, and a failed call releases it. Both run with the service
// role, so a student can't skip, fake or refund their own usage. Cost 0 (quiz marking) is speed-limited only.
export async function runAiAction<T>(
  call: (client: AiClient) => Promise<T>,
  opts: { userId: string; cost: number; signal?: AbortSignal; client?: AiClient },
): Promise<AiResult<T>> {
  if (!opts.client && !isAiConfigured()) return { ok: false, error: 'ai_unavailable' }
  const admin = adminClient()
  const { data: check, error } = await admin.rpc('ai_check', { p_user: opts.userId, p_cost: opts.cost })
  if (error) return { ok: false, error: 'ai_failed' }
  if (check !== 'ok') return { ok: false, error: check as AiErrorCode }
  try {
    return { ok: true, value: await call(opts.client ?? openai()) }
  } catch (e) {
    // The check reserved the cost so parallel requests can't overshoot; a failed call gives it back
    if (opts.cost > 0) await admin.rpc('ai_release', { p_user: opts.userId, p_cost: opts.cost })
    return { ok: false, error: classifyAiError(e, opts.signal) }
  }
}

export function classifyAiError(e: unknown, signal?: AbortSignal): AiErrorCode {
  if (signal?.aborted || e instanceof OpenAI.APIUserAbortError) return 'aborted'
  if (e instanceof AiRefusedError) return 'refused'
  if (e instanceof AiIncompleteError) return 'too_long'
  if (e instanceof AiEmptyError) return 'empty'
  // OpenAI says "insufficient_quota" when the app owner's credit has run out
  if (e instanceof OpenAI.APIError && (e as { code?: unknown }).code === 'insufficient_quota') return 'ai_unavailable'
  if (e instanceof OpenAI.RateLimitError || e instanceof OpenAI.InternalServerError || e instanceof OpenAI.APIConnectionError) return 'busy'
  if (e instanceof OpenAI.BadRequestError) return 'too_long' // in practice: the input was too big
  return 'ai_failed'
}

export function aiErrorResponse(code: AiErrorCode): Response {
  if (code === 'aborted') return new NextResponse(null, { status: 499 })
  return NextResponse.json({ error: code }, { status: STATUS[code] })
}
