// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import fs from 'node:fs'
import { PageHeader, PAGE_TITLE } from '@/components/ui/PageHeader'

// The app screens, set by docs/superpowers/specs/2026-10-24-app-screens-design.md: app type, not display type; a sidebar that recedes
afterEach(cleanup)
const css = fs.readFileSync('app/globals.css', 'utf8').replace(/\r\n/g, '\n')
const rule = (sel: string) => css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(,[^{]*)? \\{[^}]*\\}'))?.[0] ?? ''

describe('page titles are app-sized', () => {
  it('a title is 26-28px, never a landing-page 40px', () => {
    expect(PAGE_TITLE).toContain('text-[1.625rem]')
    expect(PAGE_TITLE).toContain('sm:text-[1.75rem]')
    expect(PAGE_TITLE).not.toMatch(/2\.(125|5)rem/)
    render(<PageHeader title="Courses" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Courses' }).className).toBe(PAGE_TITLE)
  })
  it('takes a one-line summary of the data under the title', () => {
    render(<PageHeader title="Courses" summary="2 courses · 14 notes" />)
    const line = screen.getByText('2 courses · 14 notes')
    expect(line.tagName).toBe('P')
    expect(line.className).toContain('text-muted')
  })
  it.each(['app/(app)/planner/page.tsx', 'app/(app)/notebooks/[id]/page.tsx'])('%s sets its own title the same way', f => {
    const src = fs.readFileSync(f, 'utf8')
    expect(src).toContain('PAGE_TITLE')
    expect(src).not.toContain('sm:text-[2.5rem]')
  })
  it('a panel title is 18px, not a 22px headline', () => {
    expect(rule('.app-root[data-look] .section-label')).toContain('font-size: 1.125rem')
  })
})

describe('the sidebar recedes', () => {
  it.each(['classic', 'studio', 'paper', 'vivid'])('%s: the sidebar sits on the page ground with a hairline, in light and dark', look => {
    const b = rule(`.app-root[data-look="${look}"] .app-sidebar`)
    expect(b).toContain('background: var(--bg)')
    expect(b).toContain('border-color: var(--line)')
    expect(b).not.toContain('color-scheme: dark')
    expect(css).not.toContain(`.dark .app-root[data-look="${look}"] .app-sidebar`)
  })
  it('Vivid keeps the student\'s colour off the sidebar: the current place is a neutral pill', () => {
    const b = rule('.app-root[data-look="vivid"] .app-sidebar')
    expect(b).toContain('--accent: var(--fg)')
    expect(b).toContain('--accent-soft: color-mix(in srgb, var(--fg) 9%, var(--bg))')
  })
  it('Playful keeps its purple sidebar', () => {
    expect(rule('.app-root[data-look="playful"] .app-sidebar')).toContain('background: #3B2A6B')
  })
})

describe('quick actions where the work is', () => {
  it('Progress has its quick actions by the title on every screen, not on phones only', () => {
    const src = fs.readFileSync('app/(app)/progress/page.tsx', 'utf8')
    expect(src).not.toContain('<div className="md:hidden"><QuickActions')
    expect(src).toMatch(/<PageHeader title="Progress"[^>]*actions=\{<QuickActions/)
  })
})

describe('Jump back in', () => {
  it('marks each kind with a plain grey icon, not an icon in a tinted square', () => {
    const src = fs.readFileSync('components/home/CourseAccess.tsx', 'utf8')
    expect(src).not.toContain('bg-accent-soft text-accent')
  })
})
