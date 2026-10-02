import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'

let A: { sb: SupabaseClient; id: string }
let B: { sb: SupabaseClient; id: string }
const pdf = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' })

beforeAll(async () => { A = await newUser(); B = await newUser() })

describe('AI import daily limit', () => {
  it('allows 20 AI imports per student per day, then refuses', async () => {
    const u = await newUser()
    const results: boolean[] = []
    for (let i = 0; i < 21; i++) results.push((await u.sb.rpc('consume_ai_import')).data as boolean)
    expect(results.slice(0, 20).every(Boolean)).toBe(true)
    expect(results[20]).toBe(false)
    // another student has their own allowance
    expect((await B.sb.rpc('consume_ai_import')).data).toBe(true)
  })
  it('cannot be reset or raised by the student', async () => {
    const u = await newUser()
    await u.sb.rpc('consume_ai_import')
    const day = new Date().toISOString().slice(0, 10)
    await u.sb.from('ai_usage').update({ imports: 0 }).eq('user_id', u.id)
    await u.sb.from('ai_usage').delete().eq('user_id', u.id)
    const { data } = await u.sb.from('ai_usage').select('imports').eq('day', day).single()
    expect(data?.imports).toBe(1)
    expect((await u.sb.rpc('consume_ai_import', { p_limit: 1000 })).error).not.toBeNull() // no caller-chosen limit
  })
})

describe('imports bucket (PDFs waiting for AI conversion)', () => {
  it('lets a student upload to, read and delete from their own folder', async () => {
    const path = `${A.id}/${crypto.randomUUID()}.pdf`
    expect((await A.sb.storage.from('imports').upload(path, pdf, { contentType: 'application/pdf' })).error).toBeNull()
    expect((await A.sb.storage.from('imports').download(path)).error).toBeNull()
    expect((await A.sb.storage.from('imports').remove([path])).error).toBeNull()
  })
  it('blocks uploading into another student\'s folder', async () => {
    const { error } = await B.sb.storage.from('imports').upload(`${A.id}/${crypto.randomUUID()}.pdf`, pdf, { contentType: 'application/pdf' })
    expect(error).not.toBeNull()
  })
  it('blocks reading another student\'s file', async () => {
    const path = `${A.id}/${crypto.randomUUID()}.pdf`
    await A.sb.storage.from('imports').upload(path, pdf, { contentType: 'application/pdf' })
    const { data } = await B.sb.storage.from('imports').download(path)
    expect(data).toBeNull()
  })
  it('blocks deleting another student\'s file', async () => {
    const path = `${A.id}/${crypto.randomUUID()}.pdf`
    await A.sb.storage.from('imports').upload(path, pdf, { contentType: 'application/pdf' })
    await B.sb.storage.from('imports').remove([path])
    expect((await A.sb.storage.from('imports').download(path)).error).toBeNull() // still there
  })
  it('only accepts PDFs', async () => {
    const { error } = await A.sb.storage.from('imports').upload(`${A.id}/x.txt`, new Blob(['hi'], { type: 'text/plain' }), { contentType: 'text/plain' })
    expect(error).not.toBeNull()
  })
})
