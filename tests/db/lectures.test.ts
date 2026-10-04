import { describe, it, expect } from 'vitest'
import { newUser, adminClient } from './helpers'

const admin = () => adminClient()
const lecture = (over: object = {}) => ({ title: 'Cell biology', duration_seconds: 600, mime: 'audio/webm', ...over })
const audio = () => new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: 'audio/webm' })
const premium = (user: string) => admin().rpc('apply_payment', {
  p_user: user, p_reference: `T${crypto.randomUUID()}`, p_product: 'pass_1m', p_amount_minor: 5000, p_currency: 'GHS',
  p_channel: 'card', p_status: 'success', p_months: 1, p_paid_at: new Date().toISOString(),
  p_customer_code: `CUS_${user}`, p_card_brand: null, p_card_last4: null,
})

describe('lectures', () => {
  it('a student keeps their own lectures; others can\'t see or change them', async () => {
    const u = await newUser(), other = await newUser()
    const { data, error } = await u.sb.from('lectures').insert(lecture()).select('id').single()
    expect(error).toBeNull()
    expect((await other.sb.from('lectures').select('id').eq('id', data!.id)).data).toEqual([])
    await other.sb.from('lectures').update({ title: 'Mine now' }).eq('id', data!.id)
    expect((await u.sb.from('lectures').select('title').eq('id', data!.id).single()).data!.title).toBe('Cell biology')
  })
  it('refuses lectures over 2 hours, other audio types and another student\'s course', async () => {
    const u = await newUser(), other = await newUser()
    const course = (await other.sb.from('courses').insert({ name: 'Theirs', color: '#000000' }).select('id').single()).data!
    expect((await u.sb.from('lectures').insert(lecture({ duration_seconds: 7201 }))).error).not.toBeNull()
    expect((await u.sb.from('lectures').insert(lecture({ mime: 'video/mp4' }))).error).not.toBeNull()
    expect((await u.sb.from('lectures').insert(lecture({ course_id: course.id }))).error).not.toBeNull()
  })
  it('audio goes in the student\'s own folder of the private lectures bucket', async () => {
    const u = await newUser(), other = await newUser()
    const path = `${u.id}/${crypto.randomUUID()}-0.webm`
    expect((await u.sb.storage.from('lectures').upload(path, audio(), { contentType: 'audio/webm' })).error).toBeNull()
    expect((await other.sb.storage.from('lectures').download(path)).data).toBeNull()
    expect((await u.sb.storage.from('lectures').upload(`${other.id}/x-0.webm`, audio(), { contentType: 'audio/webm' })).error).not.toBeNull()
    expect((await u.sb.storage.from('lectures').upload(`${u.id}/x.png`, new Blob([new Uint8Array([1])], { type: 'image/png' }), { contentType: 'image/png' })).error).not.toBeNull()
  })
})

describe('accurate transcripts: Premium, 20 hours a month', () => {
  const check = (user: string, seconds: number) => admin().rpc('transcription_check', { p_user: user, p_seconds: seconds })
  const record = (user: string, seconds: number) => admin().rpc('transcription_record', { p_user: user, p_lecture: null, p_seconds: seconds })
  it('Free students need Premium', async () => {
    const u = await newUser()
    expect((await check(u.id, 600)).data).toBe('premium_required')
  })
  it('Premium students can transcribe up to 20 hours this month', async () => {
    const u = await newUser()
    await premium(u.id)
    expect((await check(u.id, 1200)).data).toBe('ok')
    for (let i = 0; i < 10; i++) await record(u.id, 7200)
    expect((await check(u.id, 1)).data).toBe('fair_use')
  })
  it('only the server can check or record usage', async () => {
    const u = await newUser()
    expect((await u.sb.rpc('transcription_check', { p_user: u.id, p_seconds: 1 })).error).not.toBeNull()
    expect((await u.sb.rpc('transcription_record', { p_user: u.id, p_lecture: null, p_seconds: 1 })).error).not.toBeNull()
    await u.sb.from('transcription_usage').insert({ user_id: u.id, seconds: 1 })
    expect((await u.sb.from('transcription_usage').select('id')).data).toEqual([])
  })
})
