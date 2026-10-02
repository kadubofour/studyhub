import type { SupabaseClient } from '@supabase/supabase-js'
import type { Priority, Task, TaskType } from '../types'
import { check, must } from './util'

export type NewTask = { title: string; course_id?: string | null; type?: TaskType; due_at?: string | null; priority?: Priority }
const COLS = 'id,course_id,title,type,due_at,priority,done_at,created_at'

export async function listOpenTasks(sb: SupabaseClient): Promise<Task[]> {
  return must(await sb.from('tasks').select(COLS).is('done_at', null).order('due_at', { ascending: true, nullsFirst: false }))
}

export async function createTask(sb: SupabaseClient, input: NewTask): Promise<Task> {
  return must(await sb.from('tasks').insert(input).select(COLS).single())
}

export async function setTaskDone(sb: SupabaseClient, id: string, done: boolean): Promise<void> {
  check(await sb.from('tasks').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id))
}

export async function updateTask(sb: SupabaseClient, id: string, patch: Partial<NewTask>): Promise<void> {
  check(await sb.from('tasks').update(patch).eq('id', id))
}

export async function deleteTask(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('tasks').delete().eq('id', id))
}
