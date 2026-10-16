import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamKind, Priority, Task, TaskType } from '../types'
import { check, must } from './util'
import { announceProgressChanged } from '@/lib/xp/events'

export type NewTask = {
  title: string; course_id?: string | null; type?: TaskType; due_at?: string | null; priority?: Priority
  // What an exam needs (see lib/exams.ts)
  exam_kind?: ExamKind | null; duration_min?: number | null; location?: string | null; covers?: string | null; weight_pct?: number | null
}
const COLS = 'id,course_id,title,type,due_at,priority,done_at,created_at,exam_kind,duration_min,location,covers,weight_pct'

export async function listOpenTasks(sb: SupabaseClient): Promise<Task[]> {
  return must(await sb.from('tasks').select(COLS).is('done_at', null).order('due_at', { ascending: true, nullsFirst: false }))
}

// Tasks finished since `since`, newest first (the planner's Done section)
export async function listRecentlyDone(sb: SupabaseClient, since: Date, limit = 50): Promise<Task[]> {
  return must(await sb.from('tasks').select(COLS).not('done_at', 'is', null).gte('done_at', since.toISOString()).order('done_at', { ascending: false }).limit(limit))
}

export async function createTask(sb: SupabaseClient, input: NewTask): Promise<Task> {
  return must(await sb.from('tasks').insert(input).select(COLS).single())
}

export async function setTaskDone(sb: SupabaseClient, id: string, done: boolean): Promise<void> {
  check(await sb.from('tasks').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id))
  announceProgressChanged()
}

export async function updateTask(sb: SupabaseClient, id: string, patch: Partial<NewTask>): Promise<void> {
  check(await sb.from('tasks').update(patch).eq('id', id))
}

export async function deleteTask(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('tasks').delete().eq('id', id))
}

export async function countTasksDoneSince(sb: SupabaseClient, since: Date): Promise<number> {
  const { count, error } = await sb.from('tasks').select('id', { count: 'exact', head: true }).gte('done_at', since.toISOString())
  if (error) throw error
  return count ?? 0
}
