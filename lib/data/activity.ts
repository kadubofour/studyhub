import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityDay } from '@/lib/xp/rules'

// One row per local day with any activity; fails for an unknown time zone
export async function loadActivity(sb: SupabaseClient, tz: string): Promise<ActivityDay[]> {
  const { data, error } = await sb.rpc('activity_by_day', { p_tz: tz })
  if (error) throw error
  return (data ?? []) as ActivityDay[]
}
