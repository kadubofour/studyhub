// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PageHeader } from '@/components/ui/PageHeader'

afterEach(cleanup)
describe('PageHeader', () => {
  it('is the page heading, marked so it can be left to screen readers when the top bar shows the name', () => {
    render(<PageHeader title="Progress" />)
    const h1 = screen.getByRole('heading', { level: 1, name: 'Progress' })
    expect(h1.className).toContain('page-title')
  })
  it('keeps its actions', () => {
    render(<PageHeader title="Library" actions={<button>Upload</button>} />)
    expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy()
  })
})
