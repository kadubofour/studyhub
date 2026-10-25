// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
const shareItem = vi.fn(); const reshareItem = vi.fn(); const unshareItem = vi.fn()
vi.mock('@/lib/data/shares', () => ({
  shareItem: (...a: unknown[]) => shareItem(...a), reshareItem: (...a: unknown[]) => reshareItem(...a), unshareItem: (...a: unknown[]) => unshareItem(...a),
}))
import { ShareDialog } from '@/components/share/ShareDialog'

const open = async () => {
  await act(async () => {
    render(<ToastProvider><ConfirmProvider><ShareDialog onClose={() => {}} kind="deck" id="d1" title="Cells" /></ConfirmProvider></ToastProvider>)
  })
}
const writeText = vi.fn(async () => {})
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  shareItem.mockReset().mockResolvedValue('tok1'); reshareItem.mockReset().mockResolvedValue('tok2'); unshareItem.mockReset().mockResolvedValue(undefined)
  writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, 'share') })

describe('ShareDialog', () => {
  it('opening Share makes or reads the link and shows it', async () => {
    await open()
    expect(shareItem).toHaveBeenCalledWith({}, 'deck', 'd1')
    expect(screen.getByRole('heading', { name: 'Share Cells' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Link' }) as HTMLInputElement).value).toBe(`${location.origin}/s/tok1`)
  })
  it('Copy link copies it and says so', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy link' })) })
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/s/tok1`)
    expect(screen.getByRole('status').textContent).toBe('Link copied')
  })
  it('offers Share only where the device can share', async () => {
    await open()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
    cleanup()
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Share' })) })
    expect(share).toHaveBeenCalledWith({ title: 'Cells', url: `${location.origin}/s/tok1` })
  })
  it('New link replaces the link and says the old one stopped', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New link' })) })
    expect(reshareItem).toHaveBeenCalledWith({}, 'deck', 'd1')
    expect((screen.getByRole('textbox', { name: 'Link' }) as HTMLInputElement).value).toBe(`${location.origin}/s/tok2`)
    expect(screen.getByRole('status').textContent).toBe('New link made. The old one no longer works.')
  })
  it('Turn off link asks first, then turns it off', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn off link' })) })
    expect(unshareItem).not.toHaveBeenCalled()
    const ask = screen.getByRole('dialog', { name: 'Turn off this link?' })
    await act(async () => { fireEvent.click(Array.from(ask.querySelectorAll('button')).find(b => b.textContent === 'Turn off link')!) })
    expect(unshareItem).toHaveBeenCalledWith({}, 'deck', 'd1')
    expect(screen.queryByRole('textbox', { name: 'Link' })).toBeNull()
    expect(screen.getByText(/link is off/i)).toBeTruthy()
    shareItem.mockClear()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn on again' })) })
    expect(shareItem).toHaveBeenCalledTimes(1)
  })
  it('says when too many links were made', async () => {
    shareItem.mockRejectedValue(new Error('rate_limited'))
    await open()
    expect(screen.getByRole('alert').textContent).toBe('Too many links made in the last hour. Try again later.')
  })
  it('says when a link could not be made', async () => {
    shareItem.mockRejectedValue(new Error('offline'))
    await open()
    expect(screen.getByRole('alert').textContent).toBe("Couldn't make a link. Check your connection.")
  })
})
