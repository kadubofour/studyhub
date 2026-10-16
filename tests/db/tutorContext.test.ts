import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'
import { createChat, getChat, listChatContexts, setChatContext } from '@/lib/data/tutor'

const note = async (u: Awaited<ReturnType<typeof newUser>>, title = 'Krebs cycle') => (await u.sb.from('notes').insert({ title, content_md: 'x' }).select('id').single()).data!
const lecture = async (u: Awaited<ReturnType<typeof newUser>>, title = 'Week 3') =>
  (await u.sb.from('lectures').insert({ title, duration_seconds: 600, mime: 'audio/webm' }).select('id').single()).data!

describe('what a tutor chat is about', () => {
  it('can be pointed at a note, then at a lecture (which clears the note), then at nothing', async () => {
    const u = await newUser()
    const n = await note(u), l = await lecture(u)
    const c = await createChat(u.sb, { title: 'Help' })
    await setChatContext(u.sb, c.id, { note_id: n.id })
    expect(await getChat(u.sb, c.id)).toMatchObject({ note_id: n.id, lecture_id: null })
    await setChatContext(u.sb, c.id, { lecture_id: l.id })
    expect(await getChat(u.sb, c.id)).toMatchObject({ note_id: null, lecture_id: l.id })
    await setChatContext(u.sb, c.id, null)
    expect(await getChat(u.sb, c.id)).toMatchObject({ note_id: null, lecture_id: null })
  })

  it('cannot be pointed at another student\'s note', async () => {
    const u = await newUser(), other = await newUser()
    const theirs = await note(other, 'Theirs')
    const c = await createChat(u.sb, { title: 'Help' })
    await expect(setChatContext(u.sb, c.id, { note_id: theirs.id })).rejects.toBeTruthy()
  })

  it('names the note or lecture each chat is about, and nothing for a chat that is about neither', async () => {
    const u = await newUser()
    const n = await note(u, 'Glycolysis'), l = await lecture(u, 'Week 3 lecture')
    const a = await createChat(u.sb, { title: 'A', note_id: n.id }), b = await createChat(u.sb, { title: 'B', lecture_id: l.id }), c = await createChat(u.sb, { title: 'C' })
    const contexts = await listChatContexts(u.sb, [a, b, c])
    expect(contexts).toEqual({ [a.id]: { kind: 'note', title: 'Glycolysis' }, [b.id]: { kind: 'lecture', title: 'Week 3 lecture' } })
    expect(await listChatContexts(u.sb, [])).toEqual({})
  })

  it('when its note is deleted the chat is simply about nothing', async () => {
    const u = await newUser()
    const n = await note(u, 'Gone soon')
    const c = await createChat(u.sb, { title: 'A', note_id: n.id })
    await u.sb.from('notes').delete().eq('id', n.id)
    expect(await listChatContexts(u.sb, [await getChat(u.sb, c.id)])).toEqual({})
  })
})
