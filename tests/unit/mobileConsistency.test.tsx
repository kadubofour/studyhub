// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

// The phone pass for visual consistency: the same title, back link, delete button and empty state on every page
const src = (p: string) => fs.readFileSync(p, 'utf8')

describe('one page title everywhere', () => {
  it.each(['components/notes/NotesSidebar.tsx', 'app/(app)/courses/[id]/page.tsx'])('%s uses the shared page title', f => {
    expect(src(f)).toMatch(/<h1 className=\{`?\$?\{?PAGE_TITLE/)
  })
  it('a Settings section heading is a panel title, not a second page title', () => {
    expect(src('app/(app)/settings/page.tsx')).toContain('<h2 className="section-label !mb-1">{current.label}</h2>')
  })
})

describe('the way back from a page inside another', () => {
  it.each([['app/(app)/flashcards/[deck]/page.tsx', '/flashcards', 'Flashcards'], ['app/(app)/courses/[id]/page.tsx', '/courses', 'Courses'], ['app/(app)/notebooks/[id]/page.tsx', '/notes', 'Notes']])('%s links back to %s', (f, href, label) => {
    expect(src(f)).toContain(`<BackLink href="${href}">${label}</BackLink>`)
  })
})

describe('a deck page', () => {
  it('deletes with the same quiet button as a notebook', () => {
    expect(src('app/(app)/flashcards/[deck]/page.tsx')).toContain('<button className="btn-ghost hover:!text-danger" onClick={removeDeck}><Trash2 size={14} aria-hidden />Delete deck</button>')
  })
  it('does not show the keyboard shortcut on a touch screen', () => {
    expect(src('app/(app)/flashcards/[deck]/page.tsx')).toContain('<span className="pointer-coarse:hidden"> · Ctrl+Enter to add</span>')
  })
})

describe('empty states', () => {
  it('Quiz and Review use the shared empty state', () => {
    expect(src('app/(app)/quiz/page.tsx')).toContain('<EmptyState icon={ListChecks}')
    expect(src('app/(app)/review/page.tsx')).toMatch(/<EmptyState icon=\{Layers\} tone="a" title=\{title\}[^>]*level=\{1\}/)
  })
})

describe('Library filters on a phone', () => {
  it('sort and layout stay on one row, scrolling sideways if they must', () => {
    expect(src('app/(app)/library/page.tsx')).toContain('<div data-filter-row className="no-scrollbar flex items-center gap-2 overflow-x-auto max-sm:w-full max-sm:justify-between [&>*]:shrink-0">')
    expect(src('app/(app)/library/page.tsx')).toContain('className="flex-nowrap"')
  })
})

describe('the Planner on a phone', () => {
  const planner = () => src('app/(app)/planner/page.tsx')
  it('keeps its header close to what follows', () => {
    expect(planner()).toContain('<div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 md:mb-8 md:gap-y-4">')
  })
  it('lets the chosen list chip name the list below a computer\'s width, rather than a heading that repeats it', () => {
    expect(planner()).toContain('<h2 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight max-lg:sr-only">{title}</h2>')
  })
  it('fades the edge of each chip row while more chips are off-screen', () => {
    const rail = src('components/planner/TaskRail.tsx'), bar = src('components/planner/CourseBar.tsx')
    expect(rail.match(/data-more=\{/g)).toHaveLength(2)
    expect(bar).toContain('data-more={')
    expect(src('lib/ui/useEdgeFade.ts')).toContain('export function useEdgeFade')
  })
  it('draws a course chip that is not chosen like the other chips: plain, with its colour square', () => {
    expect(src('components/planner/CourseBar.tsx')).toContain("'border-transparent text-fg hover:bg-surface'")
  })
})
