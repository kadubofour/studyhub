import { describe, it, expect, vi } from 'vitest'
import { savePlan } from '@/lib/plan/service'

const input = { course_id: 'c1', exam_task_id: 'e1', mode: 'sprint' as const, minutes_per_day: 30, days_off: [0] }
const sbWith = () => {
  const calls: [string, unknown[]][] = []
  const q: Record<string, unknown> = {}
  for (const k of ['update', 'eq']) q[k] = (...a: unknown[]) => { calls.push([k, a]); return q }
  q.then = (res: (v: unknown) => unknown) => res({ error: null })
  const rpc = vi.fn(async (..._a: unknown[]) => ({ data: 'new' as string | null, error: null as { message: string } | null }))
  const from = vi.fn(() => q)
  return { sb: { from, rpc } as never, calls, rpc, from }
}

describe('savePlan', () => {
  it('creates through the database function that only replaces an ended plan', async () => {
    const { sb, rpc, from } = sbWith()
    await savePlan(sb, input)
    expect(rpc).toHaveBeenCalledWith('create_study_plan', { p_course: 'c1', p_exam: 'e1', p_mode: 'sprint', p_minutes: 30, p_days_off: [0] })
    expect(from).not.toHaveBeenCalled()
  })
  it('editing changes only the settings of that plan', async () => {
    const { sb, calls } = sbWith()
    await savePlan(sb, input, 'p1')
    expect(calls).toContainEqual(['update', [{ mode: 'sprint', minutes_per_day: 30, days_off: [0] }]])
    expect(calls).toContainEqual(['eq', ['id', 'p1']])
  })
  it('a refused create throws', async () => {
    const { sb, rpc } = sbWith()
    rpc.mockResolvedValue({ data: null, error: { message: 'duplicate' } })
    await expect(savePlan(sb, input)).rejects.toBeTruthy()
  })
})
