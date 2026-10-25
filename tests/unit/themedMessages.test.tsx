// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/providers/ToastProvider'
import { ConfirmProvider, useConfirm } from '@/components/providers/ConfirmProvider'

// The messages an action brings up live inside the app's root, so they wear the student's look and theme
// (the providers sit outside AppShell, whose .app-root carries the look's colours)
afterEach(cleanup)
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

function Toaster() { const toast = useToast(); return <button onClick={() => toast('Saved to Biology')}>go</button> }
function Asker() { const confirm = useConfirm(); return <button onClick={() => { void confirm({ title: 'Delete this note?' }) }}>ask</button> }

describe('action messages follow the look', () => {
  it('a message is drawn inside the app root', () => {
    render(<ToastProvider><div className="app-root" data-look="playful" data-testid="root"><Toaster /></div></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'go' }))
    expect(screen.getByTestId('root').contains(screen.getByRole('status'))).toBe(true)
  })
  it('is a pill in the look\'s own colours, above the phone dock', () => {
    render(<ToastProvider><div className="app-root"><Toaster /></div></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'go' }))
    const t = screen.getByRole('status')
    for (const c of ['toast', 'rounded-full', 'bg-fg', 'text-bg', 'bottom-[calc(6.5rem+env(safe-area-inset-bottom))]']) expect(t.className).toContain(c)
  })
  it('still shows with no app root (pages outside the app)', () => {
    render(<ToastProvider><Toaster /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'go' }))
    expect(screen.getByRole('status').textContent).toBe('Saved to Biology')
  })
  it('a confirm question is drawn inside the app root too', async () => {
    render(<ConfirmProvider><div className="app-root" data-testid="root"><Asker /></div></ConfirmProvider>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ask' })) })
    expect(screen.getByTestId('root').contains(screen.getByRole('dialog'))).toBe(true)
  })
})
