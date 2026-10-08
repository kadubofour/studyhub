import { adminClient } from '@/lib/supabase/admin'
import type { AiErrorCode } from './run'

// One tutor message is reserved before the model is called and given back if the call fails.
// Both run with the service role, so a student can't skip, fake or refund their own usage.
export async function reserveTutorMessage(userId: string): Promise<'ok' | AiErrorCode> {
  const { data, error } = await adminClient().rpc('tutor_check', { p_user: userId })
  if (error) return 'ai_failed'
  return data as 'ok' | AiErrorCode
}

export async function releaseTutorMessage(userId: string): Promise<void> {
  await adminClient().rpc('tutor_release', { p_user: userId })
}
