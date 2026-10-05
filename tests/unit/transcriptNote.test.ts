import { describe, it, expect } from 'vitest'
import { transcriptToNote } from '@/lib/lectures/transcriptNote'

describe('transcriptToNote', () => {
  it('turns the transcript into paragraphs at the lecturer\'s pauses, each starting with its time', () => {
    const note = transcriptToNote('Krebs cycle', [
      { start: 0, end: 3, text: 'Welcome back.' },
      { start: 3.5, end: 6, text: 'Today: the Krebs cycle.' },
      { start: 12, end: 15, text: 'It happens in the matrix.' }, // 6 s pause: new paragraph
      { start: 75, end: 80, text: '  ' }, // blank lines are left out
      { start: 750, end: 755, text: 'Questions?' },
    ])
    expect(note).toEqual({
      title: 'Krebs cycle',
      content_md: '*[0:00]* Welcome back. Today: the Krebs cycle.\n\n*[0:12]* It happens in the matrix.\n\n*[12:30]* Questions?',
    })
  })
  it('works for an empty transcript', () => {
    expect(transcriptToNote('Silent', [])).toEqual({ title: 'Silent', content_md: '' })
  })
})
