import type { SupabaseClient } from '@supabase/supabase-js'
import { check, must } from '@/lib/data/util'
import type { PlanMode, StoredSession } from './types'

export type PlanRow = {
  id: string; course_id: string; exam_task_id: string; mode: PlanMode; minutes_per_day: number; days_off: number[]
  exam: { id: string; title: string; due_at: string | null; done_at: string | null }
}
export type DayRow = { id: string; plan_id: string; day: string; sessions: StoredSession[] }
export type PlanInput = { course_id: string; exam_task_id: string; mode: PlanMode; minutes_per_day: number; days_off: number[] }

const PLAN = 'id,course_id,exam_task_id,mode,minutes_per_day,days_off,exam:tasks!inner(id,title,due_at,done_at)'
const DAY = 'id,plan_id,day,sessions'

export async function listPlans(sb: SupabaseClient): Promise<PlanRow[]> {
  return must(await sb.from('study_plans').select(PLAN).order('created_at')) as unknown as PlanRow[]
}
export async function savePlan(sb: SupabaseClient, input: PlanInput, id?: string): Promise<void> {
  if (id) check(await sb.from('study_plans').update({ mode: input.mode, minutes_per_day: input.minutes_per_day, days_off: input.days_off }).eq('id', id))
  else check(await sb.from('study_plans').insert(input))
}
export async function deletePlan(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('study_plans').delete().eq('id', id))
}
export async function listPlanDays(sb: SupabaseClient, planId: string): Promise<DayRow[]> {
  return must(await sb.from('study_plan_days').select(DAY).eq('plan_id', planId).order('day')) as unknown as DayRow[]
}
// Saves a day's list the first time; if another tab got there first, theirs is kept and returned
export async function ensureDay(sb: SupabaseClient, planId: string, day: string, sessions: StoredSession[]): Promise<DayRow> {
  check(await sb.from('study_plan_days').upsert({ plan_id: planId, day, sessions }, { onConflict: 'plan_id,day', ignoreDuplicates: true }))
  return must(await sb.from('study_plan_days').select(DAY).eq('plan_id', planId).eq('day', day).single()) as unknown as DayRow
}
export async function saveDaySessions(sb: SupabaseClient, dayId: string, sessions: StoredSession[]): Promise<void> {
  check(await sb.from('study_plan_days').update({ sessions }).eq('id', dayId))
}
