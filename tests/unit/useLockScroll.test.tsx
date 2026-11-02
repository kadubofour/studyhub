// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useLockScroll } from '@/lib/ui/useLockScroll'

function Layer({ on = true }: { on?: boolean }) { useLockScroll(on); return null }
afterEach(() => { cleanup(); document.documentElement.style.overflow = ''; document.body.style.overflow = '' })

describe('useLockScroll', () => {
  it('stops the page behind a full-screen layer scrolling, and frees it when the layer closes', () => {
    const { unmount } = render(<Layer />)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')
  })
  it('does nothing while off, and puts back what the page had', () => {
    document.body.style.overflow = 'scroll'
    const { rerender, unmount } = render(<Layer on={false} />)
    expect(document.body.style.overflow).toBe('scroll')
    rerender(<Layer on />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })
  it('with two layers open, frees the page only when the last closes', () => {
    const a = render(<Layer />), b = render(<Layer />)
    a.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    b.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
