import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createChat, deleteChat, listMessages } from '@/lib/data/tutor'

type U = { sb: SupabaseClient; id: string }
let A: U, B: U
beforeAll(async () => { A = await newUser(); B = await newUser() })
const jpg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
const bucket = (u: U) => u.sb.storage.from('tutor-files')

describe('a tutor message\'s attachments', () => {
  it('are saved with the question and read back with it; a message without any has none', async () => {
    const chat = await createChat(A.sb, {})
    const atts = [{ kind: 'photo', name: 'q1.jpg', path: `${A.id}/${chat.id}/a.jpg`, pages: 1 }, { kind: 'document', name: 'n.docx', text: 'Mitosis' }]
    expect((await A.sb.from('tutor_messages').insert({ chat_id: chat.id, role: 'user', content: 'What is this?', attachments: atts })).error).toBeNull()
    expect((await A.sb.from('tutor_messages').insert({ chat_id: chat.id, role: 'assistant', content: 'A cell.' })).error).toBeNull()
    const msgs = await listMessages(A.sb, chat.id)
    expect(msgs.map(m => m.attachments)).toEqual([atts, []])
  })
  it('must be a list', async () => {
    const chat = await createChat(A.sb, {})
    expect((await A.sb.from('tutor_messages').insert({ chat_id: chat.id, role: 'user', content: 'x', attachments: { kind: 'photo' } })).error).toBeTruthy()
  })
})

describe('the tutor-files bucket', () => {
  it('lets a student keep, read and delete a photo or PDF in their own folder', async () => {
    const path = `${A.id}/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`
    expect((await bucket(A).upload(path, jpg(), { contentType: 'image/jpeg' })).error).toBeNull()
    expect((await bucket(A).download(path)).error).toBeNull()
    expect((await bucket(A).createSignedUrl(path, 60)).data?.signedUrl).toBeTruthy()
    const pdf = `${A.id}/${crypto.randomUUID()}/w.pdf`
    expect((await bucket(A).upload(pdf, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })).error).toBeNull()
    expect((await bucket(A).remove([path, pdf])).error).toBeNull()
  })
  it('keeps other students out: no writing into, reading or deleting from someone else\'s folder', async () => {
    const path = `${A.id}/${crypto.randomUUID()}/x.jpg`
    await bucket(A).upload(path, jpg(), { contentType: 'image/jpeg' })
    expect((await bucket(B).upload(`${A.id}/${crypto.randomUUID()}/y.jpg`, jpg(), { contentType: 'image/jpeg' })).error).not.toBeNull()
    expect((await bucket(B).download(path)).data).toBeNull()
    await bucket(B).remove([path])
    expect((await bucket(A).download(path)).error).toBeNull() // still there
  })
  it('only takes photos and PDFs', async () => {
    for (const [name, type] of [['x.txt', 'text/plain'], ['x.svg', 'image/svg+xml'], ['x.mp4', 'video/mp4']]) {
      expect((await bucket(A).upload(`${A.id}/${crypto.randomUUID()}/${name}`, new Blob(['x'], { type }), { contentType: type })).error, type).not.toBeNull()
    }
  })
})

describe('deleting a chat', () => {
  it('deletes its files, and leaves the student\'s other chats\' files alone', async () => {
    const chat = await createChat(A.sb, {})
    const other = await createChat(A.sb, {})
    const mine = `${A.id}/${chat.id}/a.jpg`, theirs = `${A.id}/${other.id}/b.jpg`
    await bucket(A).upload(mine, jpg(), { contentType: 'image/jpeg' })
    await bucket(A).upload(theirs, jpg(), { contentType: 'image/jpeg' })
    await deleteChat(A.sb, chat.id)
    expect((await bucket(A).download(mine)).data).toBeNull()
    expect((await bucket(A).download(theirs)).error).toBeNull()
  })
})
