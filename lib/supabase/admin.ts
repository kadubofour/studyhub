import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role client: bypasses row-level security. Only for billing and AI usage on the server.
export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const isBillingConfigured = () => !!process.env.PAYSTACK_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY
