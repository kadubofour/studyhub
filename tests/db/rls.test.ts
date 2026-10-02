import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'

let A: { sb: SupabaseClient; id: string }
let B: { sb: SupabaseClient; id: string }
let courseId: string
let deckId: string

beforeAll(async () => {
  A = await newUser()
  B = await newUser()
  const c = await A.sb.from('courses').insert({ name: 'Biology', color: '#1D9E75' }).select('id').single()
  if (c.error) throw c.error
  courseId = c.data.id
  const d = await A.sb.from('decks').insert({ name: 'Cells', course_id: courseId }).select('id').single()
  if (d.error) throw d.error
  deckId = d.data.id
})

describe('profiles', () => {
  it('are created on signup with metadata', async () => {
    const { data } = await A.sb.from('profiles').select('*').eq('id', A.id).single()
    expect(data?.display_name).toBe('Test')
    expect(data?.timezone).toBe('America/New_York')
    expect(data?.onboarded).toBe(false)
  })
  it('are not readable by other users', async () => {
    const { data } = await B.sb.from('profiles').select('id').eq('id', A.id)
    expect(data).toEqual([])
  })
})

describe('row-level security', () => {
  it('B cannot read A\'s courses', async () => {
    const { data } = await B.sb.from('courses').select('id').eq('id', courseId)
    expect(data).toEqual([])
  })
  it('B cannot update A\'s courses', async () => {
    const { data } = await B.sb.from('courses').update({ name: 'hacked' }).eq('id', courseId).select('id')
    expect(data).toEqual([])
    const { data: still } = await A.sb.from('courses').select('name').eq('id', courseId).single()
    expect(still?.name).toBe('Biology')
  })
  it('B cannot delete A\'s courses', async () => {
    await B.sb.from('courses').delete().eq('id', courseId)
    const { data } = await A.sb.from('courses').select('id').eq('id', courseId)
    expect(data).toHaveLength(1)
  })
  it('B cannot insert rows owned by A', async () => {
    const { error } = await B.sb.from('courses').insert({ name: 'x', color: '#000000', user_id: A.id })
    expect(error).not.toBeNull()
  })
  it('B cannot attach a task to A\'s course', async () => {
    const { error } = await B.sb.from('tasks').insert({ title: 'x', course_id: courseId })
    expect(error).not.toBeNull()
  })
  it('B cannot add a card to A\'s deck', async () => {
    const { error } = await B.sb.from('cards').insert({ deck_id: deckId, front: 'q', back: 'a' })
    expect(error).not.toBeNull()
  })
  it('every table hides A\'s rows from B', async () => {
    await A.sb.from('tasks').insert({ title: 't', course_id: courseId })
    await A.sb.from('notes').insert({ title: 'n', content_md: 'x' })
    await A.sb.from('focus_sessions').insert({ started_at: new Date().toISOString(), ended_at: new Date().toISOString(), minutes: 25, completed: true })
    for (const table of ['tasks', 'notes', 'decks', 'cards', 'reviews', 'focus_sessions', 'classes']) {
      const { data, error } = await B.sb.from(table).select('id')
      expect(error, table).toBeNull()
      expect(data, table).toEqual([])
    }
  })
})
