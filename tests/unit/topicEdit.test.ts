import { describe, it, expect } from 'vitest'
import { addLink, addTopic, applyUpdate, fromAi, mergeTopics, moveTopic, removeLink, removeTopic, renameTopic, tidy, toDrafts } from '@/lib/topics/edit'
import { validateTopics } from '@/lib/topics/validate'
import type { TopicDraft, TopicStat } from '@/lib/topics/types'

const n = (id: string) => ({ kind: 'note' as const, id })
const l = (id: string) => ({ kind: 'lecture' as const, id })
const list = (): TopicDraft[] => [{ id: 't1', name: 'A', links: [n('n1')] }, { id: 't2', name: 'B', links: [n('n1'), l('l1')] }, { name: 'C', links: [] }]

describe('list edits', () => {
  it('renames, adds, removes and moves without changing the original', () => {
    const a = list()
    expect(renameTopic(a, 0, 'Alpha')[0].name).toBe('Alpha')
    expect(addTopic(a, ' New ').map(t => t.name)).toEqual(['A', 'B', 'C', ' New '])
    expect(removeTopic(a, 1).map(t => t.name)).toEqual(['A', 'C'])
    expect(moveTopic(a, 2, -1).map(t => t.name)).toEqual(['A', 'C', 'B'])
    expect(moveTopic(a, 0, -1).map(t => t.name)).toEqual(['A', 'B', 'C']) // already first
    expect(moveTopic(a, 2, 1).map(t => t.name)).toEqual(['A', 'B', 'C']) // already last
    expect(a.map(t => t.name)).toEqual(['A', 'B', 'C'])
  })
  it('merging keeps the target\'s id and gives it both topics\' links once', () => {
    const merged = mergeTopics(list(), 1, 0)
    expect(merged.map(t => t.name)).toEqual(['A', 'C'])
    expect(merged[0].id).toBe('t1')
    expect(merged[0].links).toEqual([n('n1'), l('l1')])
    expect(mergeTopics(list(), 0, 0)).toEqual(list())
  })
  it('adds and removes links, never twice', () => {
    expect(addLink(list(), 2, n('n9'))[2].links).toEqual([n('n9')])
    expect(addLink(list(), 0, n('n1'))[0].links).toEqual([n('n1')])
    expect(removeLink(list(), 1, n('n1'))[1].links).toEqual([l('l1')])
  })
  it('tidy trims names', () => {
    expect(tidy([{ name: '  A  ', links: [] }])[0].name).toBe('A')
  })
})

describe('building a list', () => {
  const stat = (id: string, name: string, position: number): TopicStat => ({
    topic_id: id, name, position, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 0, lectures: 0, decks: 0, status: 'not_started',
  })
  it('turns stats and links into drafts in position order', () => {
    const out = toDrafts([stat('t2', 'B', 2), stat('t1', 'A', 1)], [{ topic_id: 't1', link: n('n1') }, { topic_id: 't2', link: { kind: 'deck', id: 'd1' } }])
    expect(out).toEqual([{ id: 't1', name: 'A', links: [n('n1')] }, { id: 't2', name: 'B', links: [{ kind: 'deck', id: 'd1' }] }])
  })
  it('turns the AI\'s topics into new drafts', () => {
    expect(fromAi([{ name: 'Krebs', notes: ['n1'], lectures: ['l1'] }])).toEqual([{ name: 'Krebs', links: [n('n1'), l('l1')] }])
  })
  it('an update adds links to existing topics by name and appends new topics, keeping edits', () => {
    const out = applyUpdate(list(), [{ name: ' b ', notes: ['n2'], lectures: [] }, { name: 'Brand new', notes: [], lectures: ['l2'] }])
    expect(out.map(t => t.name)).toEqual(['A', 'B', 'C', 'Brand new'])
    expect(out[1].links).toEqual([n('n1'), l('l1'), n('n2')])
    expect(out[3].links).toEqual([l('l2')])
  })
  it('an update never goes past 40 topics', () => {
    const full = Array.from({ length: 40 }, (_, i) => ({ name: `T${i}`, links: [] }))
    expect(applyUpdate(full, [{ name: 'One more', notes: ['n1'], lectures: [] }])).toHaveLength(40)
  })
})

describe('validateTopics', () => {
  it('says what is wrong in plain words', () => {
    expect(validateTopics([{ name: 'A' }, { name: 'B' }])).toBeNull()
    expect(validateTopics([{ name: 'A' }, { name: '  ' }])).toBe('Every topic needs a name.')
    expect(validateTopics([{ name: 'A' }, { name: ' a ' }])).toBe('Two topics have the same name.')
    expect(validateTopics([{ name: 'x'.repeat(81) }])).toBe('Topic names can be at most 80 characters.')
    expect(validateTopics(Array.from({ length: 41 }, (_, i) => ({ name: `T${i}` })))).toBe('A course can have at most 40 topics.')
  })
})
