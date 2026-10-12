import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { must } from './util'
import type { Stats } from '@/lib/profile/stats'

export async function getProfile(sb: SupabaseClient, id: string): Promise<Profile> {
  return must(await sb.from('profiles').select('*').eq('id', id).single<Profile>())
}

export async function updateProfile(sb: SupabaseClient, id: string, patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  return must(await sb.from('profiles').update(patch).eq('id', id).select('*').single<Profile>())
}

// The totals on the profile, in one call
export async function getProfileStats(sb: SupabaseClient): Promise<Stats> {
  const rows = must(await sb.rpc('profile_stats')) as Stats | Stats[]
  return Array.isArray(rows) ? rows[0] : rows
}
