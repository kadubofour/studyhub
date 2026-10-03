import { createServerSupabase } from '@/lib/supabase/server'

// E2E ONLY: uses up the signed-in student's 10 AI requests for this minute, to test the speed limit
export async function POST() {
  if (process.env.E2E_FAKE_AI !== '1' || process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 })
  const sb = await createServerSupabase()
  for (let i = 0; i < 10; i++) await sb.rpc('ai_request_allowed')
  return Response.json({ ok: true })
}
