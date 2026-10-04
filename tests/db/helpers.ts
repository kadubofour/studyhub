import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export async function newUser(): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = `t-${crypto.randomUUID()}@example.test`
  const { data, error } = await sb.auth.signUp({
    email, password: 'local-test-pass-123',
    options: { data: { full_name: 'Test', timezone: 'America/New_York' } },
  })
  if (error || !data.user) throw error ?? new Error('no user')
  return { sb, id: data.user.id }
}

// Service-role client: what the server uses for billing and usage (bypasses RLS)
export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
