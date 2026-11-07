// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/notes', () => ({ createNote: async () => ({ id: 'new' }) }))
vi.mock('@/lib/data/tutor', () => ({ findChat: async () => null, createChat: async () => ({ id: 'chat1' }) }))
import { QuickActions } from '@/components/shell/QuickActions'
import { ToastProvider } from '@/components/providers/ToastProvider'

const ID = '11111111-1111-4111-8111-111111111111'
afterEach(() => { cleanup(); push.mockClear() })
const go = vi.fn()
const page = (extra: React.ReactNode = null) => render(<ToastProvider><QuickActions go={go} /><a href={`/notes/${ID}`}><span>Krebs cycle</span></a><a href="/home">Home</a><a href="https://example.com/notes">Out</a><input aria-label="field" />{extra}</ToastProvider>)
const rightClick = (el: Element, init: MouseEventInit = {}) => { let prevented = false; const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...init }); act(() => { el.dispatchEvent(ev) }); prevented = ev.defaultPrevented; return prevented }

describe('right click on a link to something', () => {
  it('opens a menu for it, named by the link, and takes over the browser\'s menu', () => {
    page()
    expect(rightClick(screen.getByText('Krebs cycle'))).toBe(true)
    const menu = screen.getByRole('menu', { name: 'Krebs cycle' })
    expect(menu).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Quiz me' })).toBeTruthy()
  })
  it('does what a choice says', async () => {
    page()
    rightClick(screen.getByText('Krebs cycle'))
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Make flashcards' })) })
    expect(go).toHaveBeenCalledWith(`/notes/${ID}?study=cards`)
    rightClick(screen.getByText('Krebs cycle'))
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Ask the tutor' })) })
    expect(push).toHaveBeenCalledWith('/tutor/chat1')
  })
  it('leaves the browser\'s own menu for other links, fields, other sites, Shift, and selected text', () => {
    page()
    expect(rightClick(screen.getByText('Home'))).toBe(false)
    expect(rightClick(screen.getByText('Out'))).toBe(false)
    expect(rightClick(screen.getByLabelText('field'))).toBe(false)
    expect(rightClick(screen.getByText('Krebs cycle'), { shiftKey: true })).toBe(false)
    const range = document.createRange(); range.selectNodeContents(screen.getByText('Krebs cycle')); window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
    expect(rightClick(screen.getByText('Krebs cycle'))).toBe(false)
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('steps aside when something else has already opened a menu for the click', () => {
    page()
    const a = screen.getByText('Krebs cycle')
    a.addEventListener('contextmenu', e => e.preventDefault())
    rightClick(a)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
