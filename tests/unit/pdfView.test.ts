import { describe, it, expect, vi } from 'vitest'
import { explainMessage, pixelsPerPoint } from '@/lib/files/pdfView'
import { filesAsked } from '@/lib/ai/tutorFiles'

vi.mock('server-only', () => ({}))

describe('how sharply a PDF page is drawn', () => {
  it('follows the screen, within limits', () => {
    expect(pixelsPerPoint(600, 800, 2)).toBe(2)
    expect(pixelsPerPoint(600, 800, 0.5)).toBe(1)
    expect(pixelsPerPoint(600, 800, 4)).toBe(2.5)
  })
  it('draws a very large page less sharply, so a phone can hold it', () => {
    const d = pixelsPerPoint(2700, 3800, 3)
    expect(2700 * 3800 * d * d).toBeLessThanOrEqual(12_000_001)
  })
})

describe('what Explain asks the tutor', () => {
  it('quotes the selected words and says where they are from', () => {
    expect(explainMessage('Week 3 slides.pdf', { page: 4, text: 'The  Krebs\ncycle', picked: true }))
      .toBe('Explain this from page 4 of Week 3 slides.pdf to me in plain words:\n\nThe Krebs cycle')
  })
  it('asks about the page when nothing is selected', () => {
    expect(explainMessage('a.pdf', { page: 2, text: 'Mitosis', picked: false })).toBe('Explain page 2 of a.pdf to me in plain words. It says:\n\nMitosis')
  })
  it('just names the page of a scan, which has no words to quote', () => {
    expect(explainMessage('scan.pdf', { page: 1, text: '  ', picked: false })).toBe('Explain page 1 of scan.pdf to me in plain words.')
  })
  it('keeps a long page short enough for the address', () => {
    expect(explainMessage('a.pdf', { page: 1, text: 'x'.repeat(5000), picked: false }).length).toBeLessThan(1600)
  })
  it('is worded so the tutor finds the file it is about', () => {
    const f = { id: 'f', course_id: null, note_id: null, name: 'Week 3 slides.pdf', mime: 'application/pdf', path: 'p', bytes: 1, body_status: 'ready' as const, created_at: '' }
    expect(filesAsked(explainMessage(f.name, { page: 4, text: 'Glycolysis', picked: true }), [f], [])).toEqual([f])
  })
})
