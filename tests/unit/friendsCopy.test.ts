import { describe, it, expect, vi, beforeEach } from 'vitest'

const created: { title?: string; content_md?: string }[] = []
const updated: unknown[] = []
vi.mock('@/lib/data/notes', () => ({
  createNote: async (_sb: unknown, input: { title?: string; content_md?: string }) => { created.push(input); return { id: 'new-note' } },
  updateNote: async (_sb: unknown, _id: string, patch: unknown) => { updated.push(patch) },
}))
vi.mock('@/lib/notes/prepareImage', () => ({ uploadNoteImage: async () => 'studyhub-image:mine.png' }))
import { copySharedNote } from '@/lib/friends/copy'

const sbWith = (download: (path: string) => { data: Blob | null; error: unknown }) => ({ storage: { from: () => ({ download: async (p: string) => download(p) }) } }) as never
const note = (md: string, ink: unknown = null) => ({ title: 'Krebs cycle', content_md: md, ink, owner_id: 'friend', owner_name: 'Kofi', updated_at: '' })
beforeEach(() => { created.length = 0; updated.length = 0 })

describe('saving a copy of a friend\'s note', () => {
  it('copies each picture from the friend\'s folder into yours and points the note at the copies', async () => {
    const asked: string[] = []
    const sb = sbWith(p => { asked.push(p); return { data: new Blob(['x'], { type: 'image/png' }), error: null } })
    await copySharedNote(sb, 'me', note('A ![cell](studyhub-image:theirs.png) and again ![cell](studyhub-image:theirs.png)'))
    expect(asked).toEqual(['friend/theirs.png']) // once, from their folder
    expect(created[0]).toEqual({ title: 'Krebs cycle', content_md: 'A ![cell](studyhub-image:mine.png) and again ![cell](studyhub-image:mine.png)' })
  })
  it('a picture that cannot be copied is left as its description', async () => {
    await copySharedNote(sbWith(() => ({ data: null, error: new Error('gone') })), 'me', note('See ![a cell](studyhub-image:theirs.png).'))
    expect(created[0].content_md).toBe('See a cell.')
  })
  it('keeps the drawing', async () => {
    await copySharedNote(sbWith(() => ({ data: null, error: null })), 'me', note('Text', [{ tool: 'pen' }]))
    expect(updated).toEqual([{ ink: [{ tool: 'pen' }] }])
  })
})
