// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Layers } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

afterEach(cleanup)

describe('EmptyState', () => {
  it('invites with a headline, a sentence and the actions', () => {
    render(<EmptyState icon={Layers} tone="a" title="Make your first deck" body="Group cards by topic."><button>Create a deck</button></EmptyState>)
    expect(screen.getByRole('heading', { level: 2, name: 'Make your first deck' })).toBeTruthy()
    expect(screen.getByText('Group cards by topic.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create a deck' })).toBeTruthy()
  })
  it('keeps the picture out of the reading order', () => {
    const { container } = render(<EmptyState icon={Layers} tone="b" title="t" body="b" />)
    expect(container.querySelector('[data-art]')!.getAttribute('aria-hidden')).toBe('true')
  })
  it('works without actions', () => {
    render(<EmptyState icon={Layers} tone="c" title="Nothing yet" body="Come back later." />)
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('uses the tile colour for its tone', () => {
    const { container } = render(<EmptyState icon={Layers} tone="b" title="t" body="b" />)
    expect(container.querySelector('.tile-b')).not.toBeNull()
  })
})
