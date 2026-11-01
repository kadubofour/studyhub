import { describe, it, expect, vi, beforeEach } from 'vitest'

const createNote = vi.fn(), saveCourseTopics = vi.fn()
vi.mock('@/lib/data/notes', () => ({ createNote: (...a: unknown[]) => createNote(...a) }))
vi.mock('@/lib/data/topics', () => ({ saveCourseTopics: (...a: unknown[]) => saveCourseTopics(...a) }))
import { saveStarterMaterial } from '@/lib/setup/starter'

const sb = {} as never
const topics = [{ name: 'The cell', note_md: 'a' }, { name: 'Membranes', note_md: 'b' }]
beforeEach(() => { createNote.mockReset(); saveCourseTopics.mockReset(); saveCourseTopics.mockResolvedValue(undefined) })

describe('saveStarterMaterial', () => {
  it('makes a note for each topic in the course, then the topics, each linked to its note', async () => {
    createNote.mockImplementation(async (_sb, i: { title: string }) => ({ id: `n-${i.title}` }))
    expect(await saveStarterMaterial(sb, 'c1', topics)).toBe(2)
    expect(createNote).toHaveBeenCalledWith(sb, { title: 'The cell', content_md: 'a', course_id: 'c1' })
    expect(saveCourseTopics).toHaveBeenCalledWith(sb, 'c1', [
      { name: 'The cell', links: [{ kind: 'note', id: 'n-The cell' }] },
      { name: 'Membranes', links: [{ kind: 'note', id: 'n-Membranes' }] },
    ])
  })
  it('leaves out a topic whose note could not be saved, and the rest still go in', async () => {
    createNote.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ id: 'n2' })
    expect(await saveStarterMaterial(sb, 'c1', topics)).toBe(1)
    expect(saveCourseTopics.mock.calls[0][2]).toEqual([{ name: 'Membranes', links: [{ kind: 'note', id: 'n2' }] }])
  })
  it('fails when no note could be saved, and makes no topics', async () => {
    createNote.mockRejectedValue(new Error('x'))
    await expect(saveStarterMaterial(sb, 'c1', topics)).rejects.toThrow()
    expect(saveCourseTopics).not.toHaveBeenCalled()
  })
})
