import { describe, it, expect, vi } from 'vitest'
import { AiEmptyError, AiRefusedError, MODELS } from '@/lib/ai/openai'
import { cleanPlanner, isDayKey, scanContent, scanToCards, scanToNote, scanToPlanner, type ScanFile } from '@/lib/ai/scan'

const photo = (n: number): ScanFile => ({ kind: 'image', mime: 'image/jpeg', base64: `IMG${n}` })
const pdf: ScanFile = { kind: 'pdf', name: 'Week 3.pdf', base64: 'PDF' }
const created = (output_text: string, over: object = {}) =>
  ({ responses: { create: vi.fn(async () => ({ output_text, status: 'completed', output: [], ...over })), parse: vi.fn() } })
const parsed = (output_parsed: unknown) =>
  ({ responses: { create: vi.fn(), parse: vi.fn(async () => ({ output_parsed, status: 'completed', output: [] })) } })
type Sent = { model: string; instructions: string; input: { content: { type: string }[] }[]; text?: { format: { name: string } } }
const sent = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0][0] as Sent

describe('scanContent', () => {
  it('sends the pages in order as images or a PDF, then the request', () => {
    expect(scanContent([photo(1), photo(2)], 'Go')).toEqual([
      { type: 'input_image', image_url: 'data:image/jpeg;base64,IMG1', detail: 'high' },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,IMG2', detail: 'high' },
      { type: 'input_text', text: 'Go' },
    ])
    expect(scanContent([pdf], 'Go')[0]).toEqual({ type: 'input_file', filename: 'Week 3.pdf', file_data: 'data:application/pdf;base64,PDF' })
  })
})

describe('scanToNote', () => {
  it('reads the pages with the strong model into a titled note', async () => {
    const client = created('# Cell biology\n\n## Organelles\n- Mitochondria')
    expect(await scanToNote(client as never, [photo(1)])).toEqual({ title: 'Cell biology', content_md: '## Organelles\n- Mitochondria', truncated: false })
    expect(sent(client.responses.create).model).toBe(MODELS.strong)
    expect(sent(client.responses.create).instructions).toContain('not instructions')
  })
  it('says the pages could not be read when nothing is legible', async () => {
    await expect(scanToNote(created('UNREADABLE') as never, [photo(1)])).rejects.toBeInstanceOf(AiRefusedError)
    await expect(scanToNote(created('') as never, [photo(1)])).rejects.toBeInstanceOf(AiRefusedError)
  })
  it('flags a note cut off by the output limit', async () => {
    const client = created('# T\n\nbody', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })
    expect((await scanToNote(client as never, [photo(1)])).truncated).toBe(true)
  })
})

describe('scanToCards', () => {
  it('makes cleaned cards from the page images with the strong model', async () => {
    const client = parsed({ cards: [{ front: ' Cell? ', back: 'Unit of life' }, { front: 'cell?', back: 'dup' }, { front: '', back: 'x' }] })
    expect(await scanToCards(client as never, [photo(1)])).toEqual({ cards: [{ front: 'Cell?', back: 'Unit of life' }] })
    const s = sent(client.responses.parse)
    expect(s.text?.format.name).toBe('scan_cards')
    expect(s.model).toBe(MODELS.strong)
    expect(s.input[0].content[0].type).toBe('input_image')
  })
  it('reports pages with nothing to make cards from', async () => {
    await expect(scanToCards(parsed({ cards: [] }) as never, [photo(1)])).rejects.toBeInstanceOf(AiEmptyError)
  })
})

const task = (over: object = {}) => ({ title: 'Essay', type: 'assignment' as const, due_date: '2026-10-16' as string | null, unsure: false, ...over })
const cls = (over: object = {}) => ({ course: 'Biology', day: 1, start: '09:00', end: '10:30', room: 'LT 2' as string | null, kind: 'lecture' as const, unsure: false, ...over })

describe('cleanPlanner', () => {
  it('keeps good items, trimmed', () => {
    expect(cleanPlanner({ tasks: [task({ title: '  Essay  ' })], classes: [cls({ room: '  ' })] }))
      .toEqual({ tasks: [task()], classes: [cls({ room: null })] })
  })
  it('drops blank titles and classes with impossible days or times', () => {
    const out = cleanPlanner({
      tasks: [task({ title: ' ' })],
      classes: [cls({ day: 7 }), cls({ start: '9:00' }), cls({ start: '11:00', end: '10:00' }), cls({ end: '24:00' }), cls({ course: ' ' })],
    })
    expect(out).toEqual({ tasks: [], classes: [] })
  })
  it('turns an impossible date into no date, flagged for checking', () => {
    expect(cleanPlanner({ tasks: [task({ due_date: '2026-02-30' })], classes: [] }).tasks[0]).toEqual(task({ due_date: null, unsure: true }))
    expect(isDayKey('2026-02-28')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
    expect(isDayKey('next friday')).toBe(false)
  })
})

describe('scanToPlanner', () => {
  it('tells the model today\'s date and weekday, so "Friday" becomes a date', async () => {
    const client = parsed({ tasks: [task({ due_date: '2026-10-09' })], classes: [] })
    const out = await scanToPlanner(client as never, [photo(1)], '2026-10-04')
    expect(out.tasks).toHaveLength(1)
    expect(sent(client.responses.parse).instructions).toContain('Today is 2026-10-04, a Sunday')
    expect(sent(client.responses.parse).text?.format.name).toBe('scan_planner')
  })
  it('reports pages with nothing for the planner', async () => {
    await expect(scanToPlanner(parsed({ tasks: [], classes: [] }) as never, [photo(1)], '2026-10-04')).rejects.toBeInstanceOf(AiEmptyError)
  })
})
