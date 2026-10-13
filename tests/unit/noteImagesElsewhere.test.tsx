// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import JSZip from 'jszip'

vi.mock('@/lib/supabase/client', () => ({
  supabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({ createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://s.test/${p}` }, error: null }) }) },
  }),
}))
import { MarkdownView } from '@/components/notes/MarkdownView'
import { notesToDocx } from '@/lib/export/notesToDocx'
import { noteInput } from '@/lib/ai/input'

afterEach(cleanup)

describe('a picture in a read-only note', () => {
  it('is drawn from its signed link, with its description', async () => {
    render(<MarkdownView source={'Before\n\n![The Krebs cycle](studyhub-image:a.webp)\n\nAfter'} />)
    const img = await screen.findByRole('img', { name: 'The Krebs cycle' })
    await waitFor(() => expect(img.getAttribute('src')).toBe('https://s.test/u1/a.webp'))
  })
  it('shows only the description for an address that is not ours or a web picture', async () => {
    render(<MarkdownView source="![sneaky](javascript:alert(1))" />)
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('a picture in a Word export', () => {
  const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
  const md = 'Look:\n\n![Cell](studyhub-image:a.webp)'
  it('is put in the document as a picture, and sized to fit the page', async () => {
    const load = vi.fn(async () => ({ data: PNG, width: 2000, height: 1000, type: 'png' as const }))
    const zip = await JSZip.loadAsync(await (await notesToDocx([{ title: 'T', course: null, content_md: md }], load)).arrayBuffer())
    expect(load).toHaveBeenCalledWith('a.webp')
    expect(Object.keys(zip.files).some(f => f.startsWith('word/media/'))).toBe(true)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:drawing>')
    expect(xml).toContain(`cx="${520 * 9525}"`) // 520 points wide
    expect(xml).toContain(`cy="${260 * 9525}"`) // half as tall, as the picture is
  })
  it('falls back to the description when the picture cannot be loaded', async () => {
    const zip = await JSZip.loadAsync(await (await notesToDocx([{ title: 'T', course: null, content_md: md }], async () => null)).arrayBuffer())
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).not.toContain('<w:drawing>')
    expect(xml).toContain('Cell')
  })
})

describe('a picture in text for the AI', () => {
  it('is sent as its description only', () => {
    const s = noteInput('Cells', 'Intro\n\n![The Krebs cycle](studyhub-image:a.webp)\n\nEnd')
    expect(s).toContain('The Krebs cycle')
    expect(s).not.toContain('studyhub-image')
  })
})
