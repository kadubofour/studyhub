import { test, expect } from '@playwright/test'
import { signUp, switchToMarkdown } from './helpers'

test('logged-out users are sent to login with a return path', async ({ page }) => {
  await page.goto('/planner')
  await expect(page).toHaveURL(/\/login\?next=%2Fplanner/)
})

test('a new user who started from a deep link lands there after signup and onboarding', async ({ page }) => {
  await page.goto('/planner')
  await expect(page).toHaveURL(/\/login\?next=%2Fplanner/)
  await page.getByRole('link', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/signup\?next=%2Fplanner/)
  await page.waitForLoadState('networkidle') // let the page hydrate before typing
  const email = `e2e-next-${Date.now()}@example.test`
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Confirm email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page).toHaveURL(/\/planner$/)
})

test('signup rejects mismatched emails', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Email', { exact: true }).fill('a@example.test')
  await page.getByLabel('Confirm email').fill('b@example.test')
  await page.getByLabel('Password', { exact: true }).fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  // Next.js renders its own (empty) role="alert" route announcer, so match on the message
  await expect(page.getByRole('alert').filter({ hasText: 'Those emails don\'t match.' })).toBeVisible()
})

test('add a task in the planner and complete it', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Calc problem set tomorrow')
  await expect(page.getByText(/^Due \w{3}, \w{3} \d{1,2}$/)).toBeVisible() // e.g. "Due Sat, Oct 3"
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const row = page.getByText('Calc problem set', { exact: true })
  await expect(row).toBeVisible()
  // The planner removes a task as soon as it's ticked, so click rather than check()
  await page.getByLabel('Mark Calc problem set done').click()
  await expect(row).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Calc problem set', { exact: true })).toHaveCount(0)
})

test('a task ticked by mistake can be undone', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Lab report')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const box = page.getByLabel('Mark Lab report done')
  await expect(box).toBeEnabled() // enabled once the task has saved
  await box.click()
  await expect(page.getByText('Lab report', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Lab report', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Lab report', { exact: true })).toBeVisible()
})

test('task added on home shows under Today', async ({ page }) => {
  await signUp(page)
  await page.getByLabel('Add a task').fill('Read chapter 4')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Read chapter 4')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Read chapter 4')).toBeVisible()
})

test('create a deck, add cards, and review them', async ({ page }) => {
  await signUp(page)
  await page.goto('/flashcards')
  await page.getByRole('button', { name: 'Create a deck' }).click()
  await page.getByLabel('Name').fill('Cells')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText('Cells').click()
  for (const [f, b] of [['Mitochondria?', 'ATP'], ['Nucleus?', 'DNA']]) {
    await page.getByLabel('Front').fill(f)
    await page.getByLabel('Back').fill(b)
    await page.getByRole('button', { name: 'Add card' }).click()
    await expect(page.getByText(f)).toBeVisible()
  }
  await page.getByRole('link', { name: 'Review 2' }).click()
  for (let i = 0; i < 2; i++) {
    await expect(page.getByText(`${i} / 2`)).toBeVisible()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: /Good/ })).toBeVisible()
    await page.keyboard.press('3')
  }
  await expect(page.getByText('Session complete')).toBeVisible()
  await expect(page.getByText('2 reviews')).toBeVisible()
})

test('a note persists after reload, including math', async ({ page }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await page.getByLabel('Title').fill('Quadratics')
  await switchToMarkdown(page)
  await page.getByLabel('Markdown').fill('## Formula\n\n$x^2$')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await switchToMarkdown(page)
  await expect(page.getByLabel('Markdown')).toHaveValue('## Formula\n\n$x^2$')
  await expect(page.getByLabel('Title')).toHaveValue('Quadratics')
  await expect(page.locator('.katex').first()).toBeVisible()
})

test('notes: search finds words inside a note', async ({ page }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await page.getByLabel('Title').fill('Week 3')
  await switchToMarkdown(page)
  await page.getByLabel('Markdown').fill('The Krebs cycle makes ATP')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.goto('/notes')
  await page.getByLabel('Search notes').fill('krebs')
  await expect(page.getByRole('link', { name: /Week 3/ })).toBeVisible()
  await page.getByLabel('Search notes').fill('photosynthesis')
  await expect(page.getByRole('link', { name: /Week 3/ })).toHaveCount(0)
})

test('focus timer runs and pauses', async ({ page }) => {
  await signUp(page)
  await page.goto('/focus')
  await expect(page.getByText('25:00')).toBeVisible()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText(/24:5\d/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/24:5\d/)).toBeVisible() // restored after reload
})
