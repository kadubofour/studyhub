// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { NoteMenuBar, type NoteMenuActions } from '@/components/notes/NoteMenuBar'

afterEach(cleanup)

function setup(over: Partial<React.ComponentProps<typeof NoteMenuBar>> = {}) {
  const actions: NoteMenuActions = {
    newNote: vi.fn(), importNote: vi.fn(), exportWord: vi.fn(), exportPdf: vi.fn(), deleteNote: vi.fn(),
    undo: vi.fn(), redo: vi.fn(), selectAll: vi.fn(), find: vi.fn(), insertTable: vi.fn(), insertEquation: vi.fn(),
    setMode: vi.fn(), toggleReading: vi.fn(), toggleFullWidth: vi.fn(),
  }
  render(<NoteMenuBar actions={actions} mode="rich" reading={false} fullWidth={false} {...over} />)
  return actions
}

describe('NoteMenuBar', () => {
  it('shows File, Edit and View menus', () => {
    setup()
    expect(screen.getByRole('menubar', { name: 'Note menu' })).toBeTruthy()
    for (const name of ['File', 'Edit', 'View']) expect(screen.getByRole('menuitem', { name })).toBeTruthy()
  })

  it('File menu has the note commands and runs them', async () => {
    const a = setup()
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'File' })) })
    const menu = screen.getByRole('menu', { name: 'File' })
    for (const name of ['New note', 'Import…', 'Export as Word', 'Export as PDF', 'Delete note']) {
      expect(menu.querySelector(`[role="menuitem"]`) && screen.getByRole('menuitem', { name })).toBeTruthy()
    }
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Export as Word' })) })
    expect(a.exportWord).toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull() // closes after choosing
  })

  it('Edit menu runs undo, redo, find and inserts', async () => {
    const a = setup()
    for (const [label, fn] of [['Undo', a.undo], ['Redo', a.redo], ['Find…', a.find], ['Insert equation', a.insertEquation]] as const) {
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' })) })
      await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${label.replace('…', '…')}`) })) })
      expect(fn).toHaveBeenCalled()
    }
  })

  it('Edit > Insert table opens a size grid and inserts the size picked', async () => {
    const a = setup()
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' })) })
    const item = screen.getByRole('menuitem', { name: /^Insert table/ })
    expect(item.getAttribute('aria-expanded')).toBe('false')
    await act(async () => { fireEvent.click(item) })
    expect(item.getAttribute('aria-expanded')).toBe('true')
    expect(a.insertTable).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '3 by 4 table' })) })
    expect(a.insertTable).toHaveBeenCalledWith(3, 4)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('View menu shows the current editor and toggles reading mode and full width', async () => {
    const a = setup({ mode: 'markdown', reading: true })
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'View' })) })
    expect(screen.getByRole('menuitemradio', { name: 'Markdown editor' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('menuitemradio', { name: 'Rich editor' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Reading mode' }).getAttribute('aria-checked')).toBe('true')
    await act(async () => { fireEvent.click(screen.getByRole('menuitemradio', { name: 'Rich editor' })) })
    expect(a.setMode).toHaveBeenCalledWith('rich')
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'View' })) })
    await act(async () => { fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Full width' })) })
    expect(a.toggleFullWidth).toHaveBeenCalled()
  })

  it('works from the keyboard: arrows move between menus and items, Esc closes and returns focus', async () => {
    setup()
    const file = screen.getByRole('menuitem', { name: 'File' })
    file.focus()
    await act(async () => { fireEvent.keyDown(file, { key: 'ArrowRight' }) })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit' }))
    await act(async () => { fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' }) })
    const items = screen.getByRole('menu', { name: 'Edit' }).querySelectorAll('[role^="menuitem"]')
    expect(document.activeElement).toBe(items[0])
    await act(async () => { fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' }) })
    expect(document.activeElement).toBe(items[1])
    await act(async () => { fireEvent.keyDown(document.activeElement!, { key: 'Escape' }) })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit' }))
  })

  it('only one top-level menu is in the Tab order', () => {
    setup()
    const tabbable = ['File', 'Edit', 'View'].map(n => screen.getByRole('menuitem', { name: n }).tabIndex)
    expect(tabbable.filter(t => t === 0)).toHaveLength(1)
  })
})
