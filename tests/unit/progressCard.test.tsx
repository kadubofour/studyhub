// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react'
import { ToastProvider } from '@/components/providers/ToastProvider'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
const shareProgress = vi.fn(); const progressSnapshot = vi.fn()
vi.mock('@/lib/data/shares', () => ({
  shareProgress: (...a: unknown[]) => shareProgress(...a), progressSnapshot: (...a: unknown[]) => progressSnapshot(...a),
}))
// jsdom has no canvas: the flow gets a stand-in picture; the drawing itself is tested through cardSvgMarkup below
const png = new Blob(['png'], { type: 'image/png' })
const cardPng = vi.fn()
vi.mock('@/lib/share/cardImage', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/share/cardImage')>()),
  cardPng: (...a: unknown[]) => cardPng(...a),
}))

import { ProgressCard } from '@/components/share/ProgressCard'
import { ShareProgressButton } from '@/components/share/ShareProgress'
import { cardSvgMarkup } from '@/lib/share/cardImage'

const snapshot = { level: 4, total_xp: 500, week_xp: 120, streak: 6, week_focus_minutes: 135, display_name: 'Ama Owusu', avatar_color: '#0B7A5E' }
const dialog = () => screen.getByRole('dialog', { name: 'Share my progress' })
const open = async () => {
  await act(async () => { render(<ToastProvider><ShareProgressButton /></ToastProvider>) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Share my progress' })) })
}
const writeText = vi.fn(async () => {})

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  shareProgress.mockReset().mockResolvedValue('tok1')
  progressSnapshot.mockReset().mockResolvedValue(snapshot)
  cardPng.mockReset().mockResolvedValue(png)
  writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'share'); Reflect.deleteProperty(navigator, 'canShare')
})

describe('ProgressCard', () => {
  it('the card shows the snapshot\'s level, streak and week XP', () => {
    render(<ProgressCard snapshot={snapshot} />)
    const card = screen.getByRole('img', { name: /Ama Owusu's progress/ })
    expect(card.getAttribute('viewBox')).toBe('0 0 1080 1350')
    expect(card.getAttribute('aria-label')).toBe('Ama Owusu\'s progress on Studyhub: level 4, a 6-day streak, 120 XP this week and 2h 15m of focus this week')
    const text = card.textContent ?? ''
    for (const t of ['Level', '4', '6 days', '120 XP', '2h 15m', 'Ama Owusu', 'AO', 'Studyhub']) expect(text).toContain(t)
  })

  it('a one-day streak and short focus read naturally', () => {
    render(<ProgressCard snapshot={{ ...snapshot, streak: 1, week_focus_minutes: 45 }} />)
    const text = screen.getByRole('img').textContent ?? ''
    expect(text).toContain('1 day')
    expect(text).toContain('45m')
  })

  it('the picture is drawn with the look\'s colours written in, not CSS variables', () => {
    const { container } = render(
      <div className="app-root" style={{ '--raised': '#FFFBF2', '--fg': '#2A2520', '--a-solid': '#0B7A5E', '--accent-solid': 'var(--a-solid)' } as React.CSSProperties}>
        <ProgressCard snapshot={snapshot} />
      </div>,
    )
    const markup = cardSvgMarkup(container.querySelector('svg')!)
    expect(markup).not.toContain('var(')
    expect(markup).toContain('#FFFBF2')
    expect(markup).toContain('#0B7A5E')
    expect(markup).toContain('width="1080"')
    expect(markup).toContain('height="1350"')
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"')
    // no web fonts in a picture: the device's own sans-serif
    expect(markup).toContain('font-family="system-ui')
    expect(markup).not.toContain('Times New Roman')
  })

  it('a look with serif titles keeps a serif in the picture', () => {
    const { container } = render(
      <div style={{ '--display-font': "'Newsreader', 'Newsreader Fallback'" } as React.CSSProperties}><ProgressCard snapshot={snapshot} /></div>,
    )
    const markup = cardSvgMarkup(container.querySelector('svg')!)
    expect(markup).toContain('Times New Roman')
    expect(markup).not.toContain('Newsreader')
  })
})

describe('Share my progress', () => {
  it('opening it makes the link once and shows the card', async () => {
    await open()
    expect(shareProgress).toHaveBeenCalledTimes(1)
    expect(progressSnapshot).toHaveBeenCalledWith({}, 'tok1')
    expect(within(dialog()).getByRole('img', { name: /Ama Owusu's progress/ })).toBeTruthy()
    expect(cardPng).toHaveBeenCalledTimes(1)
  })

  it('on a phone it opens the share sheet with the picture', async () => {
    const share = vi.fn(async () => {})
    const canShare = vi.fn(() => true)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })
    await open()
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Share' })) })
    expect(share).toHaveBeenCalledTimes(1)
    const arg = (share.mock.calls[0] as unknown as [{ files: File[]; url: string }])[0]
    expect(arg.url).toBe(`${location.origin}/s/tok1`)
    expect(arg.files).toHaveLength(1)
    expect(arg.files[0].name).toBe('studyhub-progress.png')
    expect(arg.files[0].type).toBe('image/png')
    expect(canShare).toHaveBeenCalledWith({ files: [expect.any(File)] })
  })

  it('closing the share sheet does nothing', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(async () => { throw new DOMException('closed', 'AbortError') }), configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    const createObjectURL = vi.fn(() => 'blob:card')
    URL.createObjectURL = createObjectURL; URL.revokeObjectURL = vi.fn()
    await open()
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Share' })) })
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(within(dialog()).queryByRole('alert')).toBeNull()
  })

  it('elsewhere it downloads the picture', async () => {
    const createObjectURL = vi.fn(() => 'blob:card')
    URL.createObjectURL = createObjectURL; URL.revokeObjectURL = vi.fn()
    const clicked: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this) })
    await open()
    expect(within(dialog()).queryByRole('button', { name: 'Share' })).toBeNull()
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Download picture' })) })
    const saved = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(saved.type).toBe('image/png')
    expect(await saved.text()).toBe('png')
    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('studyhub-progress.png')
    expect(clicked[0].href).toBe('blob:card')
  })

  it('Copy link copies the card\'s link and says so in the dialog', async () => {
    await open()
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Copy link' })) })
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/s/tok1`)
    expect(within(dialog()).getByRole('status').textContent).toBe('Link copied')
  })

  it('too many cards says to wait; other failures say to check the connection', async () => {
    shareProgress.mockRejectedValueOnce(new Error('rate_limited'))
    await open()
    expect(within(dialog()).getByRole('alert').textContent).toBe('Too many cards made in the last hour. Try again later.')
    cleanup()
    shareProgress.mockRejectedValueOnce(new Error('fetch failed'))
    await open()
    expect(within(dialog()).getByRole('alert').textContent).toBe('Couldn\'t make your card. Check your connection.')
  })
})
