// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { render, screen, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/types'

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark', setTheme: vi.fn() }) }))
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { useLook } from '@/components/providers/useLook'

const paper = { id: 'u', theme: 'system', accent: 'blue', font: 'sans', look: 'paper' } as Profile
function Probe() { return <output data-testid="look">{useLook()}</output> }
const tree = <ProfileProvider initial={paper}><Probe /></ProfileProvider>
afterEach(cleanup)

describe('useLook', () => {
  it('draws Paper on the server and on the first client render even when the theme is already dark, so hydration agrees', () => {
    expect(renderToString(tree)).toContain('paper')
  })
  it('then shows Classic once the page has mounted in dark mode', () => {
    render(tree)
    expect(screen.getByTestId('look').textContent).toBe('classic')
  })
})
