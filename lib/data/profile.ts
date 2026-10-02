import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { must } from './util'

export async function getProfile(sb: SupabaseClient, id: string): Promise<Profile> {
  return must(await sb.from('profiles').select('*').eq('id', id).single<Profile>())
}

export async function updateProfile(sb: SupabaseClient, id: string, patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  return must(await sb.from('profiles').update(patch).eq('id', id).select('*').single<Profile>())
}
