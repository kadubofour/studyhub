// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { Slice } from '@tiptap/pm/model'
import type { Profile } from '@/lib/types'

const prepare = vi.fn(async (f: Blob) => f)
const upload = vi.fn(async (..._a: unknown[]) => 'studyhub-image:new1.webp')
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({
  supabase: () => ({ storage: { from: () => ({ createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://s.test/${p}` }, error: null }) }) } }),
}))
vi.mock('@/lib/notes/prepareImage', async orig => ({
  ...(await orig<typeof import('@/lib/notes/prepareImage')>()),
  prepareImage: (...a: [Blob]) => prepare(...a),
  uploadNoteImage: (...a: unknown[]) => upload(...a),
}))
import { RichEditor } from '@/components/notes/RichEditor'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ImageError } from '@/lib/notes/prepareImage'

const profile = { id: 'u1', display_name: 'Ama', timezone: 'UTC', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', content_width: 'wide', auto_math: true, onboarded: true } as Profile
let md = ''
let editor: Editor | null = null
const open = async (markdown = '') => {
  md = markdown
  await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><RichEditor markdown={markdown} onChange={m => { md = m }} onReady={e => { editor = e }} onMarkup={() => {}} onDraw={() => {}} /></ToastProvider></ProfileProvider>) })
}
const png = (name = 'cell.png') => new File([new Uint8Array(10)], name, { type: 'image/png' })
beforeEach(() => { md = ''; editor = null; prepare.mockClear().mockImplementation(async f => f); upload.mockClear().mockResolvedValue('studyhub-image:new1.webp') })
afterEach(cleanup)

describe('adding pictures', () => {
  it('has Image and Draw buttons in the toolbar', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Image' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Draw' })).toBeTruthy()
  })
  it('puts in the pictures chosen with the file picker, named after the file', async () => {
    await open('Hello')
    const input = screen.getByLabelText('Choose pictures') as HTMLInputElement
    expect(input.accept).toBe('image/png,image/jpeg,image/webp')
    expect(input.multiple).toBe(true)
    await act(async () => { fireEvent.change(input, { target: { files: [png('Krebs cycle.png')] } }) })
    await waitFor(() => expect(md).toContain('![Krebs cycle](studyhub-image:new1.webp)'))
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledWith(expect.anything(), 'u1', expect.anything())
  })
  it('puts in several pictures one after another', async () => {
    await open()
    let n = 0
    upload.mockImplementation(async () => `studyhub-image:p${++n}.webp`)
    await act(async () => { fireEvent.change(screen.getByLabelText('Choose pictures'), { target: { files: [png('a.png'), png('b.png')] } }) })
    await waitFor(() => expect(md).toContain('studyhub-image:p2.webp'))
    expect(md).toContain('studyhub-image:p1.webp')
  })
  it('puts in a picture pasted from the clipboard, such as a screenshot', async () => {
    await open('Hello')
    const el = screen.getByLabelText('Note')
    await act(async () => { fireEvent.paste(el, { clipboardData: { files: [png('image.png')], items: [], types: ['Files'], getData: () => '' } }) })
    await waitFor(() => expect(md).toContain('studyhub-image:new1.webp'))
  })
  it('puts in a picture dropped on the note', async () => {
    await open('Hello')
    // jsdom has no layout for the drop position, so the editor's drop handler is called as the browser would
    const event = { dataTransfer: { files: [png('dropped.png')] }, clientX: 5, clientY: 5, preventDefault: vi.fn() } as unknown as DragEvent
    let handled: unknown
    await act(async () => { handled = editor!.view.someProp('handleDrop', f => f(editor!.view, event, Slice.empty, false)) })
    expect(handled).toBe(true)
    await waitFor(() => expect(md).toContain('studyhub-image:new1.webp'))
  })
  it('leaves a drop that is not a picture, or a move inside the note, to the editor', async () => {
    await open('Hello')
    const text = { dataTransfer: { files: [] }, clientX: 1, clientY: 1, preventDefault: vi.fn() } as unknown as DragEvent
    expect(editor!.view.someProp('handleDrop', f => f(editor!.view, text, Slice.empty, false))).toBeFalsy()
    const moved = { dataTransfer: { files: [png()] }, clientX: 1, clientY: 1, preventDefault: vi.fn() } as unknown as DragEvent
    expect(editor!.view.someProp('handleDrop', f => f(editor!.view, moved, Slice.empty, true))).toBeFalsy()
  })
  it('says why when a picture cannot be added, and adds nothing', async () => {
    await open('Hello')
    prepare.mockRejectedValue(new ImageError('type'))
    await act(async () => { fireEvent.change(screen.getByLabelText('Choose pictures'), { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } }) })
    await waitFor(() => expect(screen.getByText('Only PNG, JPEG and WebP pictures can go in a note.')).toBeTruthy())
    expect(upload).not.toHaveBeenCalled()
    expect(md).toBe('Hello')
  })
  it('says so when the upload fails', async () => {
    await open('Hello')
    upload.mockRejectedValue(new Error('offline'))
    await act(async () => { fireEvent.change(screen.getByLabelText('Choose pictures'), { target: { files: [png()] } }) })
    await waitFor(() => expect(screen.getByText(/couldn.t add that picture/i)).toBeTruthy())
    expect(md).toBe('Hello')
  })
})

describe('a note that has a picture', () => {
  const NOTE = 'Intro\n\n![The Krebs cycle](studyhub-image:a.webp)\n\nEnd'
  it('draws it from its signed link, with its description', async () => {
    await open(NOTE)
    const img = await screen.findByRole('img', { name: 'The Krebs cycle' })
    await waitFor(() => expect(img.getAttribute('src')).toBe('https://s.test/u1/a.webp'))
  })
  it('does not draw an address that is not ours or a web picture', async () => {
    await open('![bad](javascript:alert(1))')
    await act(async () => {})
    expect(screen.queryByRole('img', { name: 'bad' })?.getAttribute('src') ?? null).toBeNull()
  })
  it('shows Markup and Remove on a picture that is selected, and Remove takes it out of the note', async () => {
    await open(NOTE)
    await screen.findByRole('img', { name: 'The Krebs cycle' })
    expect(screen.queryByRole('button', { name: 'Markup' })).toBeNull()
    await act(async () => { editor!.commands.setNodeSelection(editor!.state.doc.content.child(0).nodeSize) })
    expect(screen.getByRole('button', { name: 'Markup' })).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove picture' })) })
    await waitFor(() => expect(md).not.toContain('studyhub-image:a.webp'))
    expect(md).toContain('Intro')
  })
  it('keeps a picture it cannot reach as a placeholder with its description, not a broken image', async () => {
    const sb = await import('@/lib/supabase/client')
    vi.spyOn(sb, 'supabase').mockReturnValue({ storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: 'x' } }) }) } } as never)
    await open(NOTE)
    await waitFor(() => expect(screen.getByText('The Krebs cycle')).toBeTruthy())
    expect(within(screen.getByLabelText('Note')).queryByRole('img', { name: 'The Krebs cycle' })).toBeNull()
  })
})
