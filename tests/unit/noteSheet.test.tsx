// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { NoteSheet } from '@/components/notes/NoteSheet'
import type { NoteMenuActions } from '@/components/notes/NoteMenuBar'

afterEach(cleanup)
const actions = (): NoteMenuActions => ({
  newNote: vi.fn(), importNote: vi.fn(), exportWord: vi.fn(), exportPdf: vi.fn(), deleteNote: vi.fn(),
  undo: vi.fn(), redo: vi.fn(), selectAll: vi.fn(), find: vi.fn(), insertTable: vi.fn(), insertEquation: vi.fn(),
  setMode: vi.fn(), toggleReading: vi.fn(), toggleFullWidth: vi.fn(), toggleAutoMath: vi.fn(), share: vi.fn(),
})
function open(p: Partial<React.ComponentProps<typeof NoteSheet>> = {}) {
  const a = actions(); const onRemind = vi.fn()
  render(<NoteSheet actions={a} mode="rich" reading={false} autoMath onRemind={onRemind} {...p} />)
  fireEvent.click(screen.getByRole('button', { name: 'Note options' }))
  return { a, onRemind, sheet: within(screen.getByRole('dialog', { name: 'Note options' })) }
}

describe('the note options sheet on a phone', () => {
  it('opens from a ⋯ button that only phones show', () => {
    render(<NoteSheet actions={actions()} mode="rich" reading={false} autoMath={false} onRemind={vi.fn()} />)
    const b = screen.getByRole('button', { name: 'Note options' })
    expect(b.className).toContain('md:hidden')
    expect(b.getAttribute('aria-haspopup')).toBe('dialog')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('is a panel sliding in from the right side, full height, over a dimmed page', () => {
    open()
    const d = screen.getByRole('dialog', { name: 'Note options' })
    for (const c of ['inset-y-0', 'right-0', 'rounded-l-3xl', 'side-in']) expect(d.className).toContain(c)
    expect(d.className).not.toContain('bottom-0')
    expect(document.querySelector('[data-sheet-backdrop]')).toBeTruthy()
  })
  it('has a close button at its top', () => {
    open()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('switches between writing and reading with one segmented control', () => {
    const { a, sheet } = open()
    const read = sheet.getByRole('radio', { name: 'Read' })
    expect(sheet.getByRole('radio', { name: 'Write' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(read)
    expect(a.toggleReading).toHaveBeenCalledTimes(1)
  })
  it('does nothing when the chosen side is tapped again', () => {
    const { a, sheet } = open({ reading: true })
    fireEvent.click(sheet.getByRole('radio', { name: 'Read' }))
    expect(a.toggleReading).not.toHaveBeenCalled()
  })
  it('switches the editor between rich and Markdown', () => {
    const { a, sheet } = open()
    fireEvent.click(sheet.getByRole('radio', { name: 'Markdown' }))
    expect(a.setMode).toHaveBeenCalledWith('markdown')
  })
  it('turns automatic maths on and off with a switch', () => {
    const { a, sheet } = open()
    const sw = sheet.getByRole('switch', { name: 'Automatic maths' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(a.toggleAutoMath).toHaveBeenCalledTimes(1)
  })
  it('lists the note\'s actions as large rows, with Delete last and in red', () => {
    const { sheet } = open()
    const rows = sheet.getAllByRole('button').filter(b => b.hasAttribute('data-sheet-row'))
    expect(rows.map(r => r.textContent)).toEqual(['Find in note', 'Insert equation', 'Remind me', 'Upload', 'Export as Word', 'Export as PDF', 'New note', 'Delete note'])
    for (const r of rows) expect(r.className).toContain('min-h-14')
    expect(rows.at(-1)!.className).toContain('text-danger')
  })
  it('runs a row\'s action and closes', () => {
    const { a, onRemind, sheet } = open()
    fireEvent.click(sheet.getByRole('button', { name: 'Export as Word' }))
    expect(a.exportWord).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Note options' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remind me' }))
    expect(onRemind).toHaveBeenCalledTimes(1)
  })
  it('leaves Share to the note\'s top bar, as notes apps have it', () => {
    const { sheet } = open()
    expect(sheet.queryByRole('button', { name: 'Share' })).toBeNull()
  })
  it('cannot insert an equation while reading', () => {
    const { sheet } = open({ reading: true })
    expect((sheet.getByRole('button', { name: 'Insert equation' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('closes with Escape, or a tap on the dimmed page', () => {
    open()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Note options' }))
    fireEvent.click(document.querySelector('[data-sheet-backdrop]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('leaves out what a phone does itself or does not need: undo, redo, select all, full width', () => {
    const { sheet } = open()
    for (const n of ['Undo', 'Redo', 'Select all', 'Full width']) expect(sheet.queryByText(n)).toBeNull()
  })
})

describe('the note page', () => {
  it('puts the options sheet in its top bar, beside the File, Edit and View menus that only wider screens show', async () => {
    const src = (await import('node:fs')).readFileSync('app/(app)/notes/[id]/page.tsx', 'utf8')
    expect(src).toContain('<div className="hidden md:block"><NoteMenuBar')
    expect(src).toContain('<NoteSheet actions={actions} mode={mode} reading={reading} autoMath={profile.auto_math}')
  })
})

describe('where the sheet is drawn', () => {
  it('at the app\'s root, not inside the top bar (whose blur would trap it there)', () => {
    render(<div className="app-root" data-testid="root"><header style={{ backdropFilter: 'blur(4px)' }} data-testid="bar">
      <NoteSheet actions={actions()} mode="rich" reading={false} autoMath={false} onRemind={vi.fn()} />
    </header></div>)
    fireEvent.click(screen.getByRole('button', { name: 'Note options' }))
    const d = screen.getByRole('dialog', { name: 'Note options' })
    expect(screen.getByTestId('bar').contains(d)).toBe(false)
    expect(d.parentElement).toBe(screen.getByTestId('root'))
  })
})

describe('Escape in the sheet', () => {
  it('only closes the sheet: it does not reach the note page, where Escape goes back to the list', () => {
    const page = vi.fn()
    window.addEventListener('keydown', page)
    open()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(page).not.toHaveBeenCalled()
    window.removeEventListener('keydown', page)
  })
})
