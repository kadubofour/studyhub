// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { Copy, Trash2 } from 'lucide-react'
import { ConfirmProvider, useConfirm } from '@/components/providers/ConfirmProvider'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
})
afterEach(cleanup)

function Asker({ onAnswer }: { onAnswer: (v: boolean) => void }) {
  const confirm = useConfirm()
  return <button onClick={async () => onAnswer(await confirm({ title: 'Delete this note?', body: 'This can\'t be undone.', confirmLabel: 'Delete', danger: true }))}>Ask</button>
}

describe('ConfirmProvider', () => {
  it('asks in an in-app dialog and resolves true when confirmed', async () => {
    const onAnswer = vi.fn()
    render(<ConfirmProvider><Asker onAnswer={onAnswer} /></ConfirmProvider>)
    await act(async () => { fireEvent.click(screen.getByText('Ask')) })
    expect(screen.getByRole('dialog', { name: 'Delete this note?' })).toBeTruthy()
    expect(screen.getByText('This can\'t be undone.')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })) })
    expect(onAnswer).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('resolves false on Cancel', async () => {
    const onAnswer = vi.fn()
    render(<ConfirmProvider><Asker onAnswer={onAnswer} /></ConfirmProvider>)
    await act(async () => { fireEvent.click(screen.getByText('Ask')) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('resolves false when the dialog is closed with Esc', async () => {
    const onAnswer = vi.fn()
    render(<ConfirmProvider><Asker onAnswer={onAnswer} /></ConfirmProvider>)
    await act(async () => { fireEvent.click(screen.getByText('Ask')) })
    await act(async () => { screen.getByRole('dialog').dispatchEvent(new Event('close')) })
    expect(onAnswer).toHaveBeenCalledWith(false)
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})

describe('ContextMenu', () => {
  const setup = (extra: MenuEntry[] = []) => {
    const copy = vi.fn(), del = vi.fn(), onClose = vi.fn()
    const items: MenuEntry[] = [
      { label: 'Copy', icon: Copy, onSelect: copy },
      { label: 'Paste', icon: Copy, onSelect: () => {}, disabled: true },
      'sep',
      { label: 'Delete', icon: Trash2, onSelect: del, danger: true },
      ...extra,
    ]
    render(<ContextMenu x={40} y={50} label="Quick actions" items={items} onClose={onClose} />)
    return { copy, del, onClose }
  }

  it('opens where you clicked with the first item focused', () => {
    setup()
    const menu = screen.getByRole('menu', { name: 'Quick actions' })
    expect(menu.style.left).toBe('40px')
    expect(menu.style.top).toBe('50px')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Copy' }))
  })

  it('runs the chosen action and closes', async () => {
    const { copy, onClose } = setup()
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' })) })
    expect(copy).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('arrows skip disabled items; Esc and clicking outside close it', async () => {
    const { onClose } = setup()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('a table entry opens the size grid inside the menu', async () => {
    const pick = vi.fn()
    const { onClose } = setup([{ label: 'Insert table', icon: Copy, onPickTable: pick }])
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: /Insert table/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '2 by 3 table' })) })
    expect(pick).toHaveBeenCalledWith(2, 3)
    expect(onClose).toHaveBeenCalled()
  })
})
