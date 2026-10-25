// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: push }) }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
// a shared page never reads pictures through the visitor's own session
vi.mock('@/lib/supabase/client', () => ({ supabase: () => { throw new Error('no session reads on a shared page') } }))

import { SharedView, type Shared } from '@/components/share/SharedView'
import { ToastProvider } from '@/components/providers/ToastProvider'

const owner = { display_name: 'Ama', avatar_color: '#0B7A5E', look: 'studio', accent: 'teal' }
const deck: Shared = { kind: 'deck', owner, item: { name: 'Cell biology', cards: [{ front: 'Mitochondria', back: 'Makes ATP' }, { front: 'Ribosome', back: 'Makes proteins' }] } }
const note: Shared = { kind: 'note', owner, item: { title: 'Krebs', content_md: 'Intro\n\n![cell](studyhub-image:abc.webp)', ink: [] } }
const T = 'a'.repeat(64)
const view = (shared: Shared | null, o: { signedIn?: boolean; copy?: boolean } = {}) =>
  render(<ToastProvider><SharedView token={T} shared={shared} signedIn={o.signedIn ?? false} askedToCopy={o.copy ?? false} /></ToastProvider>)

beforeEach(() => { push.mockClear(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('SharedView', () => {
  it('SharedView shows Shared by with the name, and the deck\'s cards', () => {
    const { container } = view(deck)
    expect(screen.getByText('Shared by')).toBeTruthy()
    expect(screen.getByText('Ama')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cell biology' })).toBeTruthy()
    for (const t of ['Mitochondria', 'Makes ATP', 'Ribosome', 'Makes proteins']) expect(screen.getByText(t)).toBeTruthy()
    // it wears the owner's look and colour
    const root = container.querySelector('.app-root') as HTMLElement
    expect(root.dataset.look).toBe('studio')
    expect(root.style.getPropertyValue('--a-solid')).toBe('#0B7A5E')
  })

  it('a turned-off link shows "This link was turned off"', () => {
    view(null)
    expect(screen.getByRole('heading', { name: 'This link was turned off' })).toBeTruthy()
    expect(screen.queryByText('Shared by')).toBeNull()
  })

  it('a note\'s pictures are drawn from the link\'s own picture address', async () => {
    view(note)
    const img = await screen.findByRole('img', { name: 'cell' })
    await waitFor(() => expect(img.getAttribute('src')).toBe(`/s/${T}/image/abc.webp`))
  })

  it('signed out, Copy goes to log in and comes back to copy', () => {
    view(deck)
    expect(screen.getByRole('link', { name: 'Copy to my Studyhub' }).getAttribute('href'))
      .toBe(`/login?next=${encodeURIComponent(`/s/${T}?copy=1`)}`)
  })

  it('signed in, Copy copies and opens the copy; coming back from log in it asks but never copies by itself', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ kind: 'note', id: 'n2' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    view(note, { signedIn: true, copy: true })
    expect(screen.getByText(/You're signed in/)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Copy to my Studyhub' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/notes/n2'))
    expect(fetchMock).toHaveBeenCalledWith(`/api/share/${T}/copy`, expect.objectContaining({ method: 'POST' }))
  })

  it('a link turned off while it was open says so when copied', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'link_off' }), { status: 410 })))
    view(deck, { signedIn: true })
    fireEvent.click(screen.getByRole('button', { name: 'Copy to my Studyhub' }))
    expect(await screen.findByRole('heading', { name: 'This link was turned off' })).toBeTruthy()
  })

  it('a notebook lists its notes and opens one in place', () => {
    view({ kind: 'notebook', owner, item: { name: 'Chemistry', notes: [{ id: 'n1', title: 'Acids', content_md: 'pH below 7', ink: [] }, { id: 'n2', title: 'Bases', content_md: 'pH above 7', ink: [] }] } })
    expect(screen.getByRole('heading', { name: 'Chemistry' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Bases/ }))
    expect(screen.getByRole('heading', { name: 'Bases' })).toBeTruthy()
    expect(screen.getByText('pH above 7')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Back to Chemistry/ }))
    expect(screen.getByRole('button', { name: /Acids/ })).toBeTruthy()
  })

  it('progress shows the progress card and cannot be copied', () => {
    view({ kind: 'progress', owner, item: { level: 4, total_xp: 500, week_xp: 120, streak: 6, week_focus_minutes: 95, display_name: 'Ama', avatar_color: '#0B7A5E' } })
    const card = screen.getByRole('img', { name: "Ama's progress on Studyhub: level 4, a 6-day streak, 120 XP this week and 1h 35m of focus this week" })
    expect(card.getAttribute('viewBox')).toBe('0 0 1080 1350')
    for (const t of ['Level', '6 days', '120 XP', '1h 35m']) expect(card.textContent).toContain(t)
    // it is drawn in the owner's look
    expect(card.closest('.app-root')?.getAttribute('data-look')).toBe('studio')
    expect(screen.queryByText('Copy to my Studyhub')).toBeNull()
  })
})
