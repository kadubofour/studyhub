import { createServerSupabase } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

// E2E ONLY: records `count` AI actions (default 10) for the signed-in student, to reach the free limit
export async function POST(request: Request) {
  if (process.env.E2E_FAKE_AI !== '1' || process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 })
  const { data: { user } } = await (await createServerSupabase()).auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const count = Math.min(10, Number(new URL(request.url).searchParams.get('count') ?? 10))
  await adminClient().rpc('ai_charge', { p_user: user.id, p_cost: count })
  return Response.json({ ok: true })
}
