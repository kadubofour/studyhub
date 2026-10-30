// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import fs from 'node:fs'
import { BTN_OUTLINE, BTN_SOFT, BTN_SOLID } from '@/components/ui/buttonStyles'
import { CreateMenu } from '@/components/shell/CreateMenu'
import { CommandPalette } from '@/components/shell/CommandPalette'

afterEach(cleanup)

describe('buttons follow the look everywhere', () => {
  it('the shared main and outline buttons are the look\'s own buttons, and the soft one is a pill', () => {
    expect(BTN_SOLID.split(' ')).toContain('btn-primary')
    expect(BTN_OUTLINE.split(' ')).toContain('btn')
    expect(BTN_SOFT).toContain('rounded-full')
  })
})

describe('Create on a phone', () => {
  it('is a sheet over a dimmed page, with large tiles in two columns', () => {
    render(<CreateMenu from="dock" onPick={vi.fn()} onClose={vi.fn()} />)
    const menu = screen.getByRole('menu', { name: 'Create' })
    expect(menu.className).toContain('grid-cols-2')
    expect(document.querySelector('[data-create-backdrop]')).toBeTruthy()
  })
  it('tapping the dimmed page closes it', () => {
    const onClose = vi.fn()
    render(<CreateMenu from="dock" onPick={vi.fn()} onClose={onClose} />)
    fireEvent.pointerDown(document.querySelector('[data-create-backdrop]')!)
    expect(onClose).toHaveBeenCalled()
  })
  it('from the sidebar it is still a short list beside it, with no backdrop', () => {
    render(<CreateMenu from="wide" onPick={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('menu', { name: 'Create' }).className).not.toContain('grid-cols-2')
    expect(document.querySelector('[data-create-backdrop]')).toBeNull()
  })
})

describe('Search on a phone', () => {
  it('hides the keyboard hints on a touch screen', () => {
    render(<CommandPalette items={[]} onClose={vi.fn()} onRun={vi.fn()} />)
    for (const hint of [screen.getByText('to move'), screen.getByText('Esc')]) expect(hint.closest('[class*="pointer-coarse:hidden"]')).toBeTruthy()
  })
  it('keeps the search box itself on a touch screen', () => {
    render(<CommandPalette items={[]} onClose={vi.fn()} onRun={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Search or jump' }).closest('[class*="pointer-coarse:hidden"]')).toBeNull()
  })
})

describe('the calendar\'s add button on a phone', () => {
  it('sits above the dock, not on it', () => {
    const src = fs.readFileSync('components/calendar/CalendarToolbar.tsx', 'utf8')
    expect(src).toContain('bottom-[calc(7.25rem+env(safe-area-inset-bottom))]')
  })
})

describe('the Look picker on a phone', () => {
  it('is a dropdown no wider than a phone, with the chosen look drawn under it', () => {
    const src = fs.readFileSync('components/settings/AppearanceCard.tsx', 'utf8')
    expect(src).toContain('<div className="max-w-sm space-y-3">')
    expect(src).toContain('<Dropdown label="Look"')
    expect(src).toContain('<LookPreview look={look}')
  })
})

describe('the dock on a phone', () => {
  it('is a small pill of icons, with each place named for screen readers', () => {
    const src = fs.readFileSync('components/shell/AppShell.tsx', 'utf8')
    expect(src).toContain('mx-auto flex w-fit items-center gap-1 rounded-full')
    expect(src).toContain('aria-label={label}')
    expect(src).not.toContain('{short ?? label}')
  })
})

describe('Home\'s greeting on a phone', () => {
  it('the focus timer is one row on the card: the session and clock on the left, its buttons on the right', async () => {
    const { HeroFocus } = await import('@/components/home/HeroFocus')
    render(<HeroFocus mode="Focus" clock="25:00" running={false} resumable={false} onToggle={vi.fn()} />)
    const box = screen.getByText('25:00').closest('[data-hero-focus]')!
    for (const c of ['max-sm:flex', 'max-sm:justify-between', 'max-sm:bg-transparent', 'max-sm:text-left']) expect(box.className).toContain(c)
    expect(screen.getByText('25:00').className).toContain('max-sm:text-[2.75rem]')
  })
  it('while it runs, Pause and Restart are round icons on a phone so they fit beside the clock, still named for screen readers', async () => {
    const { HeroFocus } = await import('@/components/home/HeroFocus')
    render(<HeroFocus mode="Focus" clock="24:58" running resumable={false} onToggle={vi.fn()} onRestart={vi.fn()} />)
    const pause = screen.getByRole('button', { name: 'Pause' })
    expect(pause.className).toContain('max-sm:w-11')
    expect(pause.querySelector('[class~="max-sm:sr-only"]')!.textContent).toBe('Pause')
    expect(screen.getByRole('button', { name: 'Restart' })).toBeTruthy()
  })
  it('on a phone the timer row comes first, then the goal as a full-width bar', async () => {
    const src = fs.readFileSync('app/(app)/home/page.tsx', 'utf8')
    expect(src).toContain('max-sm:flex-col-reverse max-sm:items-stretch')
    const { GoalRing } = await import('@/components/home/GoalRing')
    render(<GoalRing percent={30} label="36m of 2h focus" />)
    expect(document.querySelector('[data-goal-bar]')!.className).toContain('max-sm:w-full')
  })
})

describe('the focus timer on Home, on a phone', () => {
  it('fits its row: Start is short (the full name stays for screen readers) and Open is left to the top bar\'s timer', async () => {
    const { HeroFocus } = await import('@/components/home/HeroFocus')
    render(<HeroFocus mode="Focus" clock="25:00" running={false} resumable={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Start focus' }).querySelector('[class~="max-sm:sr-only"]')!.textContent).toBe(' focus')
    expect(screen.getByRole('link', { name: 'Open' }).className).toContain('max-sm:hidden')
  })
  it('on a phone Home keeps the notebook page, with the timer in one row and the shortcuts as plain icons', () => {
    const src = fs.readFileSync('app/(app)/home/page.tsx', 'utf8')
    expect(src).toContain('className="hero hero-page home-hero"')
    expect(src).toContain('<div className="mt-5 grid grid-cols-4 gap-1 border-t border-white/20 pt-3 md:hidden">')
    expect(src).not.toContain('rounded-full bg-white/20') // plain icons, no circles behind them
    expect(fs.readFileSync('components/shell/TopBar.tsx', 'utf8')).toContain('<Link href="/profile" aria-label="Profile"') // the profile is in the top bar
    expect(fs.readFileSync('components/home/HeroFocus.tsx', 'utf8')).toContain('max-sm:text-[2.75rem]')
    expect(fs.readFileSync('app/globals.css', 'utf8')).not.toContain('.home-hero { background: none')
  })
})

describe('Notes filters on a phone', () => {
  it('search on its own line, then the course, view and sort in one row that scrolls sideways', () => {
    const src = fs.readFileSync('components/notes/NotesSidebar.tsx', 'utf8')
    expect(src).toContain('<div className="relative min-w-48 flex-1 max-sm:basis-full">')
    expect(src).toContain('<div data-filter-row className="no-scrollbar -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0 [&>*]:shrink-0">')
  })
})

describe('Library filters on a phone', () => {
  const src = () => fs.readFileSync('app/(app)/library/page.tsx', 'utf8')
  it('sort and layout share one row under the search', () => {
    expect(src()).toContain('<div className="relative min-w-48 flex-1 max-sm:basis-full">')
    expect(src()).toContain('<div data-filter-row className="no-scrollbar flex items-center gap-2 overflow-x-auto max-sm:w-full max-sm:justify-between [&>*]:shrink-0">')
  })
  it('the kinds are one row that scrolls sideways, not two', () => {
    expect(src()).toContain('<div role="group" aria-label="Kinds" className="no-scrollbar -mx-5 mb-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">')
  })
})

describe('the Flashcards view controls', () => {
  it('start at the left edge, flush with the decks, like Notes and Library', () => {
    const src = fs.readFileSync('app/(app)/flashcards/page.tsx', 'utf8')
    expect(src).toContain('<ViewOptions page="decks" className="mb-3" />')
  })
})

describe('a note\'s top bar on a phone', () => {
  const src = () => fs.readFileSync('app/(app)/notes/[id]/page.tsx', 'utf8')
  it('fits on one line: the course picker gives up room first, so Study stays up beside the tutor', () => {
    expect(src()).toContain('<Dropdown label="Course" size="sm" className="w-44 min-w-0"')
    expect(src()).toMatch(/className=\{`btn max-sm:!px-3 \$\{studyOpen/)
  })
  it('on a computer, puts Study beside the tutor', () => {
    const s = src(), desk = s.slice(s.indexOf('<header ref={headRef}'))
    expect(desk.indexOf('<AskTutorButton')).toBeLessThan(desk.indexOf('aria-expanded={studyOpen}'))
  })
  it('on a phone, is Apple Notes\' bar: back to the notes, type or draw, then undo, redo, share, ⋯ and Done; the course, tutor and Study are in the ⋯ sheet', () => {
    const s = src(), phone = s.slice(s.indexOf('{showsPhone(screen) && <header'), s.indexOf('{showsComputer(screen) && <header'))
    const order = ['aria-label="Back to notes"', 'aria-label="Type or draw"', 'aria-label="Undo"', 'aria-label="Redo"', 'aria-label="Share"', '<NoteSheet ', '>Done</button>'].map(x => phone.indexOf(x))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const sheet = phone.slice(phone.indexOf('<NoteSheet '), phone.indexOf('</NoteSheet>'))
    for (const x of ['<span className="text-[15px] font-medium">Course</span>', '<AskTutorButton', '✦ Study']) expect(sheet).toContain(x)
  })
  it('the find bar still takes a line of its own', () => {
    expect(src()).toContain('{findOpen && <div className="basis-full">')
  })
})

describe('the soft button', () => {
  it('is a pill and nothing else: no squarer corner fighting it', () => {
    expect(BTN_SOFT.split(' ').filter(c => c.startsWith('rounded-'))).toEqual(['rounded-full'])
  })
})

describe('one look for every choice on a phone', () => {
  it('tabs, filters, view switches and sections on every page share the choice pill, chosen in ink', () => {
    const files = ['app/(app)/planner/page.tsx', 'app/(app)/focus/page.tsx', 'app/(app)/library/page.tsx', 'components/notes/study/StudyPanel.tsx', 'components/calendar/CalendarToolbar.tsx',
      'components/quiz/QuizStartDialog.tsx', 'components/ui/ViewOptions.tsx', 'components/ui/ChoiceChips.tsx', 'components/settings/SettingsRail.tsx', 'components/planner/CourseBar.tsx', 'components/planner/TaskRail.tsx']
    for (const f of files) expect(fs.readFileSync(f, 'utf8'), f).toMatch(/[`"']choice /)
    const css = fs.readFileSync('app/globals.css', 'utf8')
    expect(css).toContain('.app-root .choice:is([aria-selected="true"], [aria-pressed="true"], [aria-checked="true"], [aria-current="true"], [aria-current="page"]) { border-color: var(--fg) !important; background: var(--fg) !important; color: var(--bg) !important;')
  })
  it('page header actions are the look\'s buttons, not tinted ones', () => {
    expect(fs.readFileSync('components/quick/QuickActions.tsx', 'utf8')).not.toContain('BTN_SOFT')
    expect(fs.readFileSync('components/quick/NewNoteButton.tsx', 'utf8')).toContain('className = BTN_OUTLINE')
  })
})
