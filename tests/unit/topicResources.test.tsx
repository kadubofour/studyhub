// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

type Found = { url: string; title: string; kind: 'video' | 'article' }
type R = Found & { id: string; topic_id: string }
let saved: R[]
let post: { ok: true; value: { resources: Found[] } } | { ok: false; error: string; message: string }
let loadFails = false
let saveFails = false
const postAi = vi.fn(async (..._a: unknown[]) => post)
const saveResources = vi.fn(async (_sb: unknown, topicId: string, list: Found[]) => {
  if (saveFails) throw new Error('offline')
  for (const f of list) if (!saved.some(s => s.url === f.url)) saved.push({ id: `r${saved.length + 1}`, topic_id: topicId, ...f })
})
const removeResource = vi.fn(async (_sb: unknown, id: string) => { saved = saved.filter(s => s.id !== id) })
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/components/ai/aiFetch', async orig => ({ ...(await orig<typeof import('@/components/ai/aiFetch')>()), postAi: (...a: unknown[]) => postAi(...a) }))
vi.mock('@/lib/data/resources', () => ({
  MAX_SAVED: 20,
  listResources: async () => { if (loadFails) throw new Error('offline'); return [...saved] },
  saveResources: (...a: [unknown, string, Found[]]) => saveResources(...a),
  removeResource: (...a: [unknown, string]) => removeResource(...a),
}))
import { TopicResources } from '@/components/progress/TopicResources'

const yt: Found = { url: 'https://www.youtube.com/watch?v=1', title: 'Krebs cycle explained', kind: 'video' }
const kh: Found = { url: 'https://www.khanacademy.org/krebs', title: 'Krebs on Khan', kind: 'article' }
const row = (f: Found, i = 1): R => ({ id: `r${i}`, topic_id: 't1', ...f })
const many = (n: number): R[] => Array.from({ length: n }, (_, i) => row({ url: `https://x.test/${i}`, title: `T${i}`, kind: 'article' }, i))
const open = async () => {
  await act(async () => { render(<TopicResources topicId="t1" topicName="Krebs cycle" />) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resources for Krebs cycle' })) })
}
const click = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })) }) }
beforeEach(() => {
  saved = []; post = { ok: true, value: { resources: [yt, kh] } }; loadFails = false; saveFails = false
  postAi.mockClear(); saveResources.mockClear(); removeResource.mockClear()
})
afterEach(cleanup)

describe('TopicResources', () => {
  it('starts closed and loads the saved links when opened', async () => {
    saved = [row(yt)]
    await act(async () => { render(<TopicResources topicId="t1" topicName="Krebs cycle" />) })
    expect(screen.queryByText('Krebs cycle explained')).toBeNull()
    await click('Resources for Krebs cycle')
    expect(screen.getByText('Krebs cycle explained')).toBeTruthy()
  })
  it('says there is nothing yet and offers to find some, naming the cost', async () => {
    await open()
    expect(screen.getByText('No links yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Find resources' })).toBeTruthy()
    expect(screen.getByText('Uses 1 AI action')).toBeTruthy()
  })
  it('finds links, saves them, and shows each with its kind and site', async () => {
    await open()
    await click('Find resources')
    expect(postAi).toHaveBeenCalledWith('/api/ai/resources', { topicId: 't1' })
    expect(saveResources).toHaveBeenCalledTimes(1)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Video')).toBeTruthy()
    expect(within(items[0]).getByText('youtube.com')).toBeTruthy()
    expect(within(items[1]).getByText('Article')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Find more' })).toBeTruthy()
  })
  it('opens links in a new tab without handing over the opener', async () => {
    saved = [row(yt)]
    await open()
    const a = screen.getByRole('link', { name: /Krebs cycle explained/ })
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    expect(a.getAttribute('href')).toBe(yt.url)
  })
  it('never makes a link of an address that is not a web page', async () => {
    saved = [row({ url: 'javascript:alert(1)', title: 'Bad', kind: 'article' })]
    await open()
    expect(screen.queryByRole('link', { name: /Bad/ })).toBeNull()
  })
  it('removes a link', async () => {
    saved = [row(yt, 1), row(kh, 2)]
    await open()
    await click('Remove Krebs cycle explained')
    expect(removeResource).toHaveBeenCalledWith({}, 'r1')
    expect(screen.queryByText('Krebs cycle explained')).toBeNull()
    expect(screen.getByText('Krebs on Khan')).toBeTruthy()
  })
  it('shows the error and keeps the saved links when finding fails', async () => {
    saved = [row(yt)]
    post = { ok: false, error: 'busy', message: 'Could not reach the AI. Try again.' }
    await open()
    await click('Find more')
    expect(screen.getByRole('alert').textContent).toContain('Could not reach the AI')
    expect(screen.getByText('Krebs cycle explained')).toBeTruthy()
    expect(saveResources).not.toHaveBeenCalled()
  })
  it('says nothing usable came back instead of the note wording', async () => {
    post = { ok: false, error: 'empty', message: 'The AI could not find enough in this note to work with.' }
    await open()
    await click('Find resources')
    expect(screen.getByRole('alert').textContent).toContain('No usable links came back')
  })
  it('says so when the links could not be saved', async () => {
    saveFails = true
    await open()
    await click('Find resources')
    expect(screen.getByRole('alert').textContent).toContain('Could not save')
  })
  it('says so when the saved links could not be loaded', async () => {
    loadFails = true
    await open()
    expect(screen.getByRole('alert').textContent).toContain('Could not load')
  })
  it('does not search when the topic already has 20 links', async () => {
    saved = many(20)
    await open()
    expect(screen.getByText('This topic is full. Remove a link to find more.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Find more' })).toBeNull()
  })
  it('saves only as many as fit under 20', async () => {
    saved = many(19)
    await open()
    await click('Find more')
    expect(saveResources.mock.calls[0][2]).toHaveLength(1)
  })
})
