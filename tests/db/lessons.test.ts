import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createChat, deleteChat } from '@/lib/data/tutor'
import { deleteLesson, lessonVoices, listLessons } from '@/lib/data/lessons'
import { cleanLesson } from '@/lib/lesson/script'

let A: { sb: SupabaseClient; id: string }
let B: { sb: SupabaseClient; id: string }
const mp3 = () => new Blob(['mp3-bytes'], { type: 'audio/mpeg' })
const el = (id: string) => ({ id, kind: 'box', x: 10, y: 10, w: 30, h: 16, x2: 0, y2: 0, text: id, color: 'accent' })
const script = (audio: (string | null)[]) => {
  const s = cleanLesson({ title: 'Krebs', elements: [el('a'), el('b')], steps: [{ narration: 'One.', show: ['a'], focus: [] }, { narration: 'Two.', show: ['b'], focus: [] }] })
  return { ...s, steps: s.steps.map((st, i) => ({ ...st, audio: audio[i] })) }
}

beforeAll(async () => { A = await newUser(); B = await newUser() })

async function lessonWithVoices(u = A) {
  const chat = await createChat(u.sb, { title: 'Respiration' })
  const lessonId = crypto.randomUUID()
  const paths = [0, 1].map(i => `${u.id}/${chat.id}/${lessonId}-${i}.mp3`)
  for (const p of paths) expect((await u.sb.storage.from('lessons').upload(p, mp3(), { contentType: 'audio/mpeg' })).error).toBeNull()
  const s = script(paths)
  const { error } = await u.sb.from('tutor_lessons').insert({ id: lessonId, chat_id: chat.id, title: s.title, script: s })
  expect(error).toBeNull()
  return { chat, lessonId, paths, script: s }
}

describe('visual lessons', () => {
  it('are kept with their chat, with the script and where each voice is', async () => {
    const { chat, lessonId, paths } = await lessonWithVoices()
    const [lesson] = await listLessons(A.sb, chat.id)
    expect(lesson.id).toBe(lessonId)
    expect(lesson.script.steps.map(s => s.audio)).toEqual(paths)
    const links = await lessonVoices(A.sb, lesson.script)
    expect(links.every(l => !!l && l.startsWith('http'))).toBe(true)
  })
  it('are private: another student cannot list one, read its voice, or make one in a chat that is not theirs', async () => {
    const { chat, lessonId, paths } = await lessonWithVoices()
    expect(await listLessons(B.sb, chat.id)).toEqual([])
    expect((await B.sb.storage.from('lessons').download(paths[0])).data).toBeNull()
    expect((await B.sb.storage.from('lessons').createSignedUrl(paths[0], 60)).data).toBeNull()
    await B.sb.storage.from('lessons').remove(paths)
    await B.sb.from('tutor_lessons').delete().eq('id', lessonId)
    expect((await A.sb.storage.from('lessons').download(paths[0])).error).toBeNull()
    expect(await listLessons(A.sb, chat.id)).toHaveLength(1)
    const { error } = await B.sb.from('tutor_lessons').insert({ chat_id: chat.id, title: 'x', script: script([null, null]) })
    expect(error).not.toBeNull()
    expect((await B.sb.storage.from('lessons').upload(`${A.id}/${chat.id}/x.mp3`, mp3(), { contentType: 'audio/mpeg' })).error).not.toBeNull()
  })
  it('only take mp3 voices', async () => {
    const chat = await createChat(A.sb, { title: 'x' })
    for (const [name, type] of [['x.wav', 'audio/wav'], ['x.png', 'image/png'], ['x.txt', 'text/plain']]) {
      const { error } = await A.sb.storage.from('lessons').upload(`${A.id}/${chat.id}/${name}`, new Blob(['x'], { type }), { contentType: type })
      expect(error, type).not.toBeNull()
    }
  })
  it('go with their voices when one is deleted', async () => {
    const { chat, paths } = await lessonWithVoices()
    const [lesson] = await listLessons(A.sb, chat.id)
    await deleteLesson(A.sb, lesson)
    expect(await listLessons(A.sb, chat.id)).toEqual([])
    expect((await A.sb.storage.from('lessons').download(paths[0])).data).toBeNull()
  })
  it('go with their chat, voices and all', async () => {
    const { chat, paths } = await lessonWithVoices()
    await deleteChat(A.sb, chat.id)
    expect((await A.sb.from('tutor_lessons').select('id').eq('chat_id', chat.id)).data).toEqual([])
    for (const p of paths) expect((await A.sb.storage.from('lessons').download(p)).data).toBeNull()
  })
})
