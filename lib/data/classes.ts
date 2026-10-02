import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClassSlot } from '../types'
import { check, must } from './util'

const COLS = 'id,course_id,day_of_week,start_time,end_time,location,kind'

export async function listClasses(sb: SupabaseClient): Promise<ClassSlot[]> {
  return must(await sb.from('classes').select(COLS).order('day_of_week').order('start_time'))
}

export async function createClass(sb: SupabaseClient, input: Omit<ClassSlot, 'id'>): Promise<ClassSlot> {
  return must(await sb.from('classes').insert(input).select(COLS).single())
}

export async function updateClass(sb: SupabaseClient, id: string, patch: Partial<Omit<ClassSlot, 'id'>>): Promise<void> {
  check(await sb.from('classes').update(patch).eq('id', id))
}

export async function deleteClass(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('classes').delete().eq('id', id))
}
