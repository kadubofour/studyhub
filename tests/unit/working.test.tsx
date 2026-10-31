// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import fs from 'node:fs'
import { Working } from '@/components/ui/Working'

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('a wait, drawn', () => {
  it('says what is happening, with a moving picture that screen readers skip', () => {
    render(<Working kind="read" label="Reading your PDF" />)
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Reading your PDF')
    expect(status.querySelector('[aria-hidden] svg.working-art')).toBeTruthy()
  })
  it('names its steps one after another, staying on the last', () => {
    vi.useFakeTimers()
    render(<Working kind="write" label="Summarising" steps={['Picking out the main ideas', 'Writing them up short']} />)
    expect(screen.getByText('Picking out the main ideas')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(2800) })
    expect(screen.getByText('Writing them up short')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(screen.getByText('Writing them up short')).toBeTruthy()
  })
  it('has a picture for each kind of work', () => {
    for (const kind of ['read', 'scan', 'write', 'cards', 'quiz', 'check', 'search', 'listen', 'think', 'load', 'draw'] as const) {
      const { container, unmount } = render(<Working kind={kind} label="x" size="sm" />)
      expect(container.querySelector('svg.working-art')?.childNodes.length, kind).toBeGreaterThan(0)
      unmount()
    }
  })
  it('holds still for anyone who asks for less motion', () => {
    const css = fs.readFileSync('app/globals.css', 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.working-art \* \{ animation: none !important; \}/)
  })
})
