// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { beforeAll } from 'vitest'

const push = vi.fn(), replace = vi.fn()
let pathname = '/home'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), usePathname: () => pathname }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { name: 'Biology', title: 'Krebs chat' } }) }) }) }) }) }))
const updateCourse = vi.fn(async (..._a: unknown[]) => {}), deleteCourse = vi.fn(async (..._a: unknown[]) => {})
const renameChat = vi.fn(async (..._a: unknown[]) => {}), deleteChat = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/data/courses', () => ({ updateCourse: (...a: unknown[]) => updateCourse(...a), deleteCourse: (...a: unknown[]) => deleteCourse(...a) }))
vi.mock('@/lib/data/notes', () => ({ createNote: async () => ({ id: 'new' }) }))
vi.mock('@/lib/data/tutor', () => ({ findChat: async () => null, createChat: async () => ({ id: 'chat1' }), renameChat: (...a: unknown[]) => renameChat(...a), deleteChat: (...a: unknown[]) => deleteChat(...a) }))
import { QuickActions } from '@/components/shell/QuickActions'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { CHATS_CHANGED } from '@/lib/tutor/events'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
const ID = '11111111-1111-4111-8111-111111111111'
afterEach(() => { cleanup(); [push, replace, updateCourse, deleteCourse, renameChat, deleteChat].forEach(f => f.mockClear()); pathname = '/home' })
const go = vi.fn()
const COURSE = '22222222-2222-4222-8222-222222222222', CHAT = '33333333-3333-4333-8333-333333333333'
const page = (extra: React.ReactNode = null) => render(<ToastProvider><ConfirmProvider><QuickActions go={go} /><a href={`/courses/${COURSE}`}><span>3 Biology 2 notes</span></a><a href={`/tutor/${CHAT}`}>Krebs chat</a><a href={`/notes/${ID}`}><span>Krebs cycle</span></a><a href="/home">Home</a><a href="https://example.com/notes">Out</a><input aria-label="field" />{extra}</ConfirmProvider></ToastProvider>)
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

  describe('renaming and deleting a course or a chat', () => {
    it('renames a course, starting from its real name and not the card\'s words', async () => {
      page()
      rightClick(screen.getByText('3 Biology 2 notes'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Rename…' })) })
      const box = screen.getByLabelText('Name') as HTMLInputElement
      expect(box.value).toBe('Biology')
      fireEvent.change(box, { target: { value: '  Cell biology ' } })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
      expect(updateCourse).toHaveBeenCalledWith(expect.anything(), COURSE, { name: 'Cell biology' })
    })
    it('renames a chat and says the list changed', async () => {
      const heard = vi.fn(); window.addEventListener(CHATS_CHANGED, heard)
      page()
      rightClick(screen.getByText('Krebs chat'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Rename…' })) })
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Krebs revision' } })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
      expect(renameChat).toHaveBeenCalledWith(expect.anything(), CHAT, 'Krebs revision')
      expect(heard).toHaveBeenCalledTimes(1)
      window.removeEventListener(CHATS_CHANGED, heard)
    })
    it('saves nothing for an empty or unchanged name', async () => {
      page()
      rightClick(screen.getByText('Krebs chat'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Rename…' })) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
      expect(renameChat).not.toHaveBeenCalled()
    })
    it('asks before deleting a chat, deletes it when sure, and leaves it alone otherwise', async () => {
      const heard = vi.fn(); window.addEventListener(CHATS_CHANGED, heard)
      page()
      rightClick(screen.getByText('Krebs chat'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' })) })
      expect(screen.getByText('Delete this chat?')).toBeTruthy()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
      expect(deleteChat).not.toHaveBeenCalled()
      rightClick(screen.getByText('Krebs chat'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' })) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })) })
      expect(deleteChat).toHaveBeenCalledWith(expect.anything(), CHAT)
      expect(heard).toHaveBeenCalledTimes(1)
      expect(replace).not.toHaveBeenCalled() // not on that chat's page
      window.removeEventListener(CHATS_CHANGED, heard)
    })
    it('leaves a chat\'s page when that chat is deleted from it', async () => {
      pathname = `/tutor/${CHAT}`
      page()
      rightClick(screen.getByText('Krebs chat'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' })) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })) })
      expect(replace).toHaveBeenCalledWith('/tutor')
    })
    it('deleting a course asks what to do with what is in it, and does what is chosen', async () => {
      page()
      rightClick(screen.getByText('3 Biology 2 notes'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' })) })
      expect(screen.getByText('Delete Biology?')).toBeTruthy()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep them (no course)' })) })
      expect(deleteCourse).toHaveBeenCalledWith(expect.anything(), COURSE, { deleteContents: false })
      rightClick(screen.getByText('3 Biology 2 notes'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' })) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete its tasks, decks and notes' })) })
      expect(deleteCourse).toHaveBeenLastCalledWith(expect.anything(), COURSE, { deleteContents: true })
    })
    it('leaves a course\'s page when it is deleted from there, and deletes nothing on Cancel', async () => {
      pathname = `/courses/${COURSE}`
      page()
      rightClick(screen.getByText('3 Biology 2 notes'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' })) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
      expect(deleteCourse).not.toHaveBeenCalled()
      rightClick(screen.getByText('3 Biology 2 notes'))
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' })) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep them (no course)' })) })
      expect(replace).toHaveBeenCalledWith('/courses')
    })
  })
})
