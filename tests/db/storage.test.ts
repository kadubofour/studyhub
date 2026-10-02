import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'

let A: { sb: SupabaseClient; id: string }
let B: { sb: SupabaseClient; id: string }
const pdf = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' })

beforeAll(async () => { A = await newUser(); B = await newUser() })

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
  it('only accepts PDFs', async () => {
    const { error } = await A.sb.storage.from('imports').upload(`${A.id}/x.txt`, new Blob(['hi'], { type: 'text/plain' }), { contentType: 'text/plain' })
    expect(error).not.toBeNull()
  })
})
