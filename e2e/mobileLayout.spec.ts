import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { signUp } from './helpers'

// A small phone: nothing may run off the side, and what is tapped must be big enough to tap
test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'mobile', 'phone layout only') })

const PAGES = ['/home', '/planner', '/focus', '/progress', '/library', '/notes', '/lectures', '/flashcards', '/tutor', '/courses', '/settings', '/profile', '/plans']

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
// Buttons, links and fields on screen that are smaller than 36 px either way (inline text links and sliders excepted)
const tooSmall = (page: Page, within?: string) => page.evaluate((root) => {
  const scope = root ? document.querySelector(root) : document.body
  return Array.from(scope?.querySelectorAll('button, [role="menuitem"], [role="tab"], [role="radio"], [role="switch"]') ?? [])
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]') && !el.classList.contains('sr-only') && (r.height < 36 || r.width < 32) })
    .map(el => `${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 24)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
}, within ?? null)

test('no page runs off the side of a phone', async ({ page }) => {
  test.setTimeout(240_000)
  await signUp(page)
  for (const p of PAGES) {
    await page.goto(p)
    await page.waitForLoadState('networkidle')
    expect(await sideways(page), p).toBeLessThanOrEqual(0)
  }
})

test('the top bar, the note toolbar and the drawing tools can be tapped', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  expect(await tooSmall(page, 'header[aria-label="Today at a glance"]')).toEqual([])
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Choose pictures').setInputFiles(path.join(__dirname, 'fixtures', 'cell.png'))
  await expect(page.locator('.ProseMirror img')).toBeVisible()
  await page.locator('.ProseMirror img').click()
  expect(await sideways(page)).toBeLessThanOrEqual(0)
  expect(await tooSmall(page)).toEqual([])
  await page.getByRole('button', { name: 'Draw', exact: true }).click()
  const panel = page.getByRole('group', { name: 'Draw on the note' })
  await expect(panel).toBeVisible()
  const box = (await panel.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(375)
  expect(await tooSmall(page, '[aria-label="Draw on the note"]')).toEqual([])
})

test('Upload and Scan open as a sheet from the bottom that fits the screen', async ({ page }) => {
  await signUp(page)
  for (const name of ['Upload', 'Scan']) {
    await page.getByRole('button', { name }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeLessThanOrEqual(1)
    expect(box.width).toBeGreaterThanOrEqual(373) // the full width
    expect(box.y + box.height).toBeGreaterThanOrEqual(810) // sitting on the bottom edge
    expect(await sideways(page)).toBeLessThanOrEqual(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  }
})

test('the planner on a phone: tasks start as one line, and the calendar fits with its add button', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await page.goto('/planner')
  await page.waitForLoadState('networkidle')
  // Tasks: only the one line to type in until it is used, then the course and type choices appear
  await expect(page.getByRole('radiogroup', { name: 'Course', exact: true })).toBeHidden()
  await page.getByLabel('Add a task').click()
  await expect(page.getByRole('radiogroup', { name: 'Type' })).toBeVisible()
  expect(await sideways(page)).toBeLessThanOrEqual(0)

  // Calendar: Day / Week / Month in one full-width switch, and the Add buttons behind one round button
  await page.getByRole('tab', { name: 'Week' }).click()
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Add to calendar' }).click()
  for (const n of ['Add task', 'Add exam', 'Add class']) await expect(page.getByRole('menuitem', { name: n })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Add class' }).click()
  await expect(page.getByRole('heading', { name: 'Add class' })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await sideways(page)).toBeLessThanOrEqual(0)
  const group = page.getByRole('group', { name: 'View' })
  const box = (await group.boundingBox())!
  expect(box.width).toBeGreaterThan(300)

  // Month: tapping a day opens it
  await group.getByRole('button', { name: 'Month' }).click()
  const today = page.locator('[data-day][aria-current], [data-day]').first()
  await today.click({ position: { x: 20, y: 60 } })
  await expect(group.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
})

test('the top bar names the page, and the bottom bar has five places with More opening the rest', async ({ page }) => {
  await signUp(page)
  const top = page.getByRole('banner')
  await expect(top).toContainText('Home')
  const bar = page.getByRole('navigation', { name: 'Main' })
  await expect(bar.locator('a, button')).toHaveText(['Home', 'Planner', 'Scan', 'Notes', 'More'])
  const box = (await bar.boundingBox())!
  expect(box.y + box.height).toBeGreaterThanOrEqual(810) // on the bottom edge
  // The dev-only Next.js badge can sit over More, so it is pressed directly
  await bar.getByRole('button', { name: 'More' }).dispatchEvent('click')
  const sheet = page.getByRole('dialog', { name: 'More' })
  await expect(sheet.getByRole('link')).toHaveText(['Flashcards', 'Lectures', 'Tutor', 'Focus', 'Library', 'Progress', 'Courses', /Profile/, 'Settings'])
  const s = (await sheet.boundingBox())!
  expect(s.width).toBeGreaterThanOrEqual(373)
  await sheet.getByRole('link', { name: 'Flashcards' }).click()
  await expect(page).toHaveURL(/\/flashcards/)
  await expect(page.getByRole('banner')).toContainText('Flashcards')
  expect(await sideways(page)).toBeLessThanOrEqual(0)
})
