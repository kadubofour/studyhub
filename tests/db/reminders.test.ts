import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createReminder, deleteReminder, deleteReminders, listReminders, updateReminder } from '@/lib/data/reminders'
import { EXPORT_TABLES } from '@/lib/account/export'

type U = { sb: SupabaseClient; id: string }
let A: U, B: U
beforeAll(async () => { A = await newUser(); B = await newUser() })

describe('my reminders', () => {
  it('are made, listed by day and time, changed and kept to their owner', async () => {
    const later = await createReminder(A.sb, { title: 'Pay rent', day: '2026-11-01', at: '09:00', repeat: 'once' })
    const sooner = await createReminder(A.sb, { title: '  Email my tutor  ', day: '2026-10-24', at: '16:00', repeat: 'weekly' })
    expect(sooner.title).toBe('Email my tutor')
    expect((await listReminders(A.sb)).map(r => [r.title, r.day, r.at.slice(0, 5), r.repeat])).toEqual([
      ['Email my tutor', '2026-10-24', '16:00', 'weekly'], ['Pay rent', '2026-11-01', '09:00', 'once'],
    ])
    await updateReminder(A.sb, later.id, { title: 'Pay the rent', at: '10:30', repeat: 'daily' })
    expect((await listReminders(A.sb)).find(r => r.id === later.id)).toMatchObject({ title: 'Pay the rent', repeat: 'daily' })
    expect(await listReminders(B.sb)).toEqual([])
    expect((await B.sb.from('reminders').update({ title: 'hacked' }).eq('id', later.id).select('id')).data).toEqual([])
    expect((await B.sb.from('reminders').select('id').eq('id', later.id)).data).toEqual([])
    expect((await B.sb.from('reminders').delete().eq('id', later.id).select('id')).data).toEqual([])
    expect((await B.sb.from('reminders').insert({ user_id: A.id, title: 'Planted', day: '2026-10-24', at: '08:00' })).error).toBeTruthy()
  })
  it('refuse an empty title, a very long one, and a repeat it does not know', async () => {
    const ok = { day: '2026-10-24', at: '08:00' }
    expect((await A.sb.from('reminders').insert({ ...ok, title: '   ' })).error).toBeTruthy()
    expect((await A.sb.from('reminders').insert({ ...ok, title: 'x'.repeat(121) })).error).toBeTruthy()
    expect((await A.sb.from('reminders').insert({ ...ok, title: 'Fine', repeat: 'hourly' })).error).toBeTruthy()
  })
  it('are deleted one at a time, or several at once', async () => {
    const a = await createReminder(A.sb, { title: 'One', day: '2026-10-20', at: '08:00', repeat: 'once' })
    const b = await createReminder(A.sb, { title: 'Two', day: '2026-10-21', at: '08:00', repeat: 'once' })
    const c = await createReminder(A.sb, { title: 'Three', day: '2026-10-22', at: '08:00', repeat: 'once' })
    await deleteReminder(A.sb, a.id)
    await deleteReminders(A.sb, [b.id, c.id])
    expect((await listReminders(A.sb)).map(r => r.title)).not.toEqual(expect.arrayContaining(['One', 'Two', 'Three']))
  })
  it('are in the data download', () => {
    expect(EXPORT_TABLES).toContain('reminders')
  })
})

describe('a reminder about something', () => {
  it('keeps the page it is about and its name, and only ever a path inside Studyhub', async () => {
    const r = await createReminder(A.sb, { title: 'Review Cells', day: '2026-10-24', at: '18:00', repeat: 'daily', href: '/flashcards/d1', link_label: 'Cells' })
    expect((await listReminders(A.sb)).find(x => x.id === r.id)).toMatchObject({ href: '/flashcards/d1', link_label: 'Cells' })
    const ok = { title: 'x', day: '2026-10-24', at: '08:00' }
    for (const href of ['https://evil.example', '//evil.example', 'javascript:alert(1)']) expect((await A.sb.from('reminders').insert({ ...ok, href })).error, href).toBeTruthy()
  })
})
