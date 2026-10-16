import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createTask, listOpenTasks, updateTask } from '@/lib/data/tasks'

type U = { sb: SupabaseClient; id: string }
let A: U, B: U
beforeAll(async () => { A = await newUser(); B = await newUser() })

describe('exam details on a task', () => {
  it('keeps the kind, length, place, what it covers and what it counts for', async () => {
    const t = await createTask(A.sb, { title: 'Biology midterm', type: 'exam', due_at: '2026-11-14T14:00:00Z', exam_kind: 'midterm', duration_min: 120, location: 'Hall B', covers: 'Chapters 1 to 5', weight_pct: 30 })
    expect(t).toMatchObject({ exam_kind: 'midterm', duration_min: 120, location: 'Hall B', covers: 'Chapters 1 to 5', weight_pct: 30 })
    const open = (await listOpenTasks(A.sb)).find(x => x.id === t.id)!
    expect(open).toMatchObject({ exam_kind: 'midterm', duration_min: 120, location: 'Hall B', covers: 'Chapters 1 to 5', weight_pct: 30 })
  })

  it('an ordinary task has none of them', async () => {
    const t = await createTask(A.sb, { title: 'Read ch 3' })
    expect(t).toMatchObject({ exam_kind: null, duration_min: null, location: null, covers: null, weight_pct: null })
  })

  it('can change them, and clear them', async () => {
    const t = await createTask(A.sb, { title: 'Quiz', type: 'exam', duration_min: 30, location: 'Room 4' })
    await updateTask(A.sb, t.id, { duration_min: 45, location: null })
    const now = (await listOpenTasks(A.sb)).find(x => x.id === t.id)!
    expect(now).toMatchObject({ duration_min: 45, location: null })
  })

  it('refuses nonsense', async () => {
    await expect(createTask(A.sb, { title: 'x', type: 'exam', exam_kind: 'pop' as never })).rejects.toBeTruthy()
    await expect(createTask(A.sb, { title: 'x', type: 'exam', duration_min: 2 })).rejects.toBeTruthy()
    await expect(createTask(A.sb, { title: 'x', type: 'exam', duration_min: 900 })).rejects.toBeTruthy()
    await expect(createTask(A.sb, { title: 'x', type: 'exam', weight_pct: 101 })).rejects.toBeTruthy()
    await expect(createTask(A.sb, { title: 'x', type: 'exam', location: '' })).rejects.toBeTruthy()
    await expect(createTask(A.sb, { title: 'x', type: 'exam', covers: 'y'.repeat(1001) })).rejects.toBeTruthy()
  })

  it('is private to its owner like any task', async () => {
    const t = await createTask(A.sb, { title: 'Secret exam', type: 'exam', location: 'Hall A' })
    expect((await listOpenTasks(B.sb)).some(x => x.id === t.id)).toBe(false)
  })
})
