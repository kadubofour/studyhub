// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import JSZip from 'jszip'
import type { Editor } from '@tiptap/react'
import type { Profile } from '@/lib/types'

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({
  supabase: () => ({ auth: { getSession: async () => ({ data: { session: null } }) }, storage: { from: () => ({}) } }),
}))
import { MarkdownView } from '@/components/notes/MarkdownView'
import { RichEditor } from '@/components/notes/RichEditor'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { notesToDocx } from '@/lib/export/notesToDocx'

// jsdom has no layout; ProseMirror asks for it when it scrolls the selection into view
const noRects = () => [] as unknown as DOMRectList
Range.prototype.getClientRects ??= noRects
Element.prototype.getClientRects ??= noRects
Range.prototype.getBoundingClientRect ??= () => new DOMRect()
afterEach(cleanup)

describe('marked-up text in the reading view and preview', () => {
  const md = 'A <mark class="hl hl-green">key idea</mark> and <u>underlined</u> and **<mark class="hl hl-pink">bold pink</mark>**.'
  it('draws highlights and underline as marks around the words', () => {
    const { container } = render(<MarkdownView source={md} />)
    expect(container.querySelector('mark.hl-green')?.textContent).toBe('key idea')
    expect(container.querySelector('u')?.textContent).toBe('underlined')
    expect(container.querySelector('strong mark.hl-pink')?.textContent).toBe('bold pink')
  })
  it('does not draw any other raw HTML', () => {
    const { container } = render(<MarkdownView source={'Hi <script>alert(1)</script> <mark onclick="x()">no</mark> <mark class="hl hl-evil">no</mark>'} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('mark')).toBeNull()
  })
})

describe('marked-up text in a Word export', () => {
  it('keeps the highlight colour and the underline, and no tags', async () => {
    const blob = await notesToDocx([{ title: 'T', course: null, content_md: 'A <mark class="hl hl-green">key idea</mark> and <u>underlined</u> text <b>x</b>' }])
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string')
    expect(xml).toContain('key idea')
    expect(xml).toContain('w:fill="86EFAC"')
    expect(xml).toContain('<w:u ')
    expect(xml).not.toContain('&lt;mark')
    expect(xml).not.toContain('&lt;u&gt;')
  })
})

describe('the highlight tools in the editor', () => {
  const profile = { id: 'u1', display_name: 'Ama', timezone: 'UTC', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', content_width: 'wide', auto_math: true, onboarded: true } as Profile
  it('highlights the selected words with one Highlight button, with no colours to choose from, and takes it off again', async () => {
    let md = ''
    let editor: Editor | null = null
    await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><RichEditor markdown="Alpha beta gamma" onChange={m => { md = m }} onReady={e => { editor = e }} /></ToastProvider></ProfileProvider>) })
    expect(screen.getAllByRole('button', { name: /^Highlight/ })).toHaveLength(1)
    expect(screen.queryByRole('group', { name: 'Highlight' })).toBeNull()
    await act(async () => { editor!.commands.setTextSelection({ from: 7, to: 11 }) }) // "beta"
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Highlight' })) })
    expect(md).toBe('Alpha <mark class="hl hl-yellow">beta</mark> gamma')
    expect(screen.getByRole('button', { name: 'Highlight' }).getAttribute('aria-pressed')).toBe('true')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Underline' })) })
    expect(md).toContain('<u>')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Highlight' })) })
    expect(md).not.toContain('<mark')
  })
})
