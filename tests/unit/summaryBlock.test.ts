// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'
import { getSummary, setSummary, removeSummary } from '@/lib/notes/summaryBlock'

const note = '## Krebs cycle\n\nHappens in the matrix.'
const summary = 'The cycle makes **NADH**.\n\n- Matrix\n- 2 turns per glucose'

describe('summary block', () => {
  it('adds a summary quote block at the very top', () => {
    const md = setSummary(note, summary)
    expect(md.startsWith('> **Summary**\n')).toBe(true)
    expect(md.endsWith(note)).toBe(true)
    expect(getSummary(md)).toBe(summary)
  })
  it('replaces an existing summary instead of stacking another', () => {
    const md = setSummary(setSummary(note, 'Old.'), 'New.')
    expect(md.match(/\*\*Summary\*\*/g)).toHaveLength(1)
    expect(getSummary(md)).toBe('New.')
    expect(md.endsWith(note)).toBe(true)
  })
  it('removes it and leaves the student\'s note untouched', () => {
    expect(removeSummary(setSummary(note, summary))).toBe(note)
    expect(removeSummary(note)).toBe(note)
    expect(getSummary(note)).toBeNull()
  })
  it('ignores an ordinary quote, and a Summary quote that is not at the top', () => {
    expect(getSummary('> just a quote\n\nText')).toBeNull()
    expect(getSummary('Intro\n\n> **Summary**\n> x')).toBeNull()
  })
  it('works on an empty note', () => {
    expect(getSummary(setSummary('', 'S.'))).toBe('S.')
    expect(removeSummary(setSummary('', 'S.'))).toBe('')
  })
  it('survives a round trip through the rich editor', () => {
    const editor = new Editor({ extensions: noteExtensions(), content: setSummary(note, summary), contentType: 'markdown' })
    const md = editor.getMarkdown()
    expect(getSummary(md)).toBe(summary)
    expect(removeSummary(md).trim()).toBe(note)
    editor.destroy()
  })
})
