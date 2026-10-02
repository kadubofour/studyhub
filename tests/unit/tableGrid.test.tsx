// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TableGridPicker } from '@/components/notes/TableGridPicker'

afterEach(cleanup)

const lit = () => document.querySelectorAll('[data-lit="true"]').length

describe('TableGridPicker', () => {
  it('lights up the rows and columns under the pointer and says the size', () => {
    render(<TableGridPicker onPick={() => {}} />)
    fireEvent.mouseEnter(screen.getByRole('button', { name: '3 by 4 table' }))
    expect(lit()).toBe(12)
    expect(screen.getByText('3 × 4 table')).toBeTruthy()
  })

  it('inserts the size you click', () => {
    const onPick = vi.fn()
    render(<TableGridPicker onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: '2 by 5 table' }))
    expect(onPick).toHaveBeenCalledWith(2, 5)
  })

  it('works from the keyboard: arrows grow the selection, Enter inserts, Esc cancels', () => {
    const onPick = vi.fn()
    const onCancel = vi.fn()
    render(<TableGridPicker onPick={onPick} onCancel={onCancel} autoFocus />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '1 by 1 table' }))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '2 by 3 table' }))
    expect(lit()).toBe(6)
    fireEvent.click(document.activeElement!) // Enter on a button
    expect(onPick).toHaveBeenCalledWith(2, 3)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('only the current cell is in the Tab order', () => {
    render(<TableGridPicker onPick={() => {}} />)
    expect(screen.getAllByRole('button').filter(b => b.tabIndex === 0)).toHaveLength(1)
  })
})
