import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'

let A: { sb: SupabaseClient; id: string }
let B: { sb: SupabaseClient; id: string }
// a 1x1 PNG
const png = () => new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))], { type: 'image/png' })

beforeAll(async () => { A = await newUser(); B = await newUser() })

describe('note-images bucket', () => {
  it('lets a student store, read and delete a picture in their own folder', async () => {
    const path = `${A.id}/${crypto.randomUUID()}.png`
    expect((await A.sb.storage.from('note-images').upload(path, png(), { contentType: 'image/png' })).error).toBeNull()
    expect((await A.sb.storage.from('note-images').download(path)).error).toBeNull()
    const signed = await A.sb.storage.from('note-images').createSignedUrl(path, 60)
    expect(signed.data?.signedUrl).toBeTruthy()
    expect((await A.sb.storage.from('note-images').remove([path])).error).toBeNull()
  })
  it('blocks writing into another student\'s folder', async () => {
    const { error } = await B.sb.storage.from('note-images').upload(`${A.id}/${crypto.randomUUID()}.png`, png(), { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })
  it('blocks reading, signing and deleting another student\'s picture', async () => {
    const path = `${A.id}/${crypto.randomUUID()}.png`
    await A.sb.storage.from('note-images').upload(path, png(), { contentType: 'image/png' })
    expect((await B.sb.storage.from('note-images').download(path)).data).toBeNull()
    expect((await B.sb.storage.from('note-images').createSignedUrl(path, 60)).data).toBeNull()
    await B.sb.storage.from('note-images').remove([path])
    expect((await A.sb.storage.from('note-images').download(path)).error).toBeNull() // still there
  })
  it('only accepts PNG, JPEG and WebP', async () => {
    for (const [name, type] of [['x.gif', 'image/gif'], ['x.svg', 'image/svg+xml'], ['x.pdf', 'application/pdf'], ['x.txt', 'text/plain']]) {
      const { error } = await A.sb.storage.from('note-images').upload(`${A.id}/${name}`, new Blob(['x'], { type }), { contentType: type })
      expect(error, type).not.toBeNull()
    }
    for (const [name, type] of [['a.jpg', 'image/jpeg'], ['a.webp', 'image/webp']]) {
      expect((await A.sb.storage.from('note-images').upload(`${A.id}/${crypto.randomUUID()}-${name}`, png(), { contentType: type })).error, type).toBeNull()
    }
  })
  it('refuses a picture over 5 MB', async () => {
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' })
    const { error } = await A.sb.storage.from('note-images').upload(`${A.id}/${crypto.randomUUID()}.png`, big, { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })
})
