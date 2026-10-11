import { describe, it, expect, vi } from 'vitest'
import { EXPORT_TABLES, exportMyData } from '@/lib/account/export'

// A stand-in client: every table has the rows given, served in pages like PostgREST does
function client(rows: Record<string, unknown[]>, fail?: string, email: string | null = 'ama@example.test') {
  const asked: { table: string; select: string; order: string; from: number; to: number }[] = []
  const from = (table: string) => {
    let range: [number, number] = [0, 999]
    let select = '*'
    let order = ''
    const q: Record<string, unknown> = {}
    q.select = (cols: string) => { select = cols; return q }
    q.order = (col: string) => { order = col; return q }
    q.eq = () => q
    q.range = (a: number, b: number) => { range = [a, b]; return q }
    q.then = (res: (v: unknown) => unknown) => {
      asked.push({ table, select, order, from: range[0], to: range[1] })
      if (table === fail) return res({ data: null, error: { message: 'boom' } })
      return res({ data: (rows[table] ?? []).slice(range[0], range[1] + 1), error: null })
    }
    return q
  }
  return { sb: { from, auth: { getUser: async () => ({ data: { user: email ? { email } : null } }) } } as never, asked }
}

describe('exportMyData', () => {
  it('reads every table the student owns, and says what it is', async () => {
    const { sb } = client({ notes: [{ id: 'n1', title: 'Krebs' }], cards: [{ id: 'c1' }] })
    const out = await exportMyData(sb, new Date('2026-10-11T10:00:00Z'))
    expect(out.app).toBe('Studyhub')
    expect(out.exported_at).toBe('2026-10-11T10:00:00.000Z')
    expect(Object.keys(out.data)).toEqual([...EXPORT_TABLES])
    expect(out.data.notes).toEqual([{ id: 'n1', title: 'Krebs' }])
    expect(out.data.cards).toEqual([{ id: 'c1' }])
    expect(out.data.reviews).toEqual([])
  })
  it('covers the tables with personal content, including payments and the plan', () => {
    for (const t of ['profiles', 'notes', 'cards', 'lectures', 'tutor_messages', 'quiz_attempts', 'topic_resources', 'game_plays', 'tasks', 'payments', 'entitlements']) expect(EXPORT_TABLES).toContain(t)
  })
  it('never asks for the billing tokens, and orders a table with no id column by its own key', async () => {
    const { sb, asked } = client({})
    await exportMyData(sb)
    const plan = asked.find(a => a.table === 'entitlements')!
    expect(plan.select).not.toMatch(/email_token|subscription_code|customer_code/)
    expect(plan.select).toContain('premium_until')
    expect(plan.order).toBe('user_id')
    expect(asked.find(a => a.table === 'payments')!.select).toBe('*')
  })
  it('adds the sign-in email, and still works when it cannot be read', async () => {
    expect((await exportMyData(client({}).sb)).account).toEqual({ email: 'ama@example.test' })
    expect((await exportMyData(client({}, undefined, null).sb)).account).toEqual({ email: null })
  })
  it('reads long tables page by page so nothing is cut off at 1000 rows', async () => {
    const reviews = Array.from({ length: 2500 }, (_, i) => ({ id: `r${i}` }))
    const { sb, asked } = client({ reviews })
    const out = await exportMyData(sb)
    expect(out.data.reviews).toHaveLength(2500)
    expect(asked.filter(a => a.table === 'reviews').map(a => a.from)).toEqual([0, 1000, 2000])
  })
  it('fails as a whole, naming the table, if one table cannot be read', async () => {
    const { sb } = client({}, 'notes')
    await expect(exportMyData(sb)).rejects.toThrow(/notes/)
  })
})

describe('the export file', () => {
  it('is plain JSON a student can open', async () => {
    const { sb } = client({ notes: [{ id: 'n1', title: 'Café' }] })
    const text = JSON.stringify(await exportMyData(sb), null, 2)
    expect(JSON.parse(text).data.notes[0].title).toBe('Café')
    void vi
  })
})
