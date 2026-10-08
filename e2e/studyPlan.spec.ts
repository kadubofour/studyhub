import { test, expect, type Page } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

async function menu(page: Page, name: string, item: string) {
  await page.getByRole('menuitem', { name, exact: true }).click()
  await page.getByRole('menu', { name }).locator('[role^="menuitem"]', { hasText: item }).click()
}
async function inBiology(page: Page) {
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH'),
    page.getByLabel('Course').selectOption({ label: 'Biology' }),
  ])
}
// Two Biology notes, topics drafted and saved, then an exam next week: ready for a plan
async function readyForPlan(page: Page) {
  await signUp(page)
  await noteWithText(page)
  await inBiology(page)
  await menu(page, 'File', 'New note')
  await expect(page.getByLabel('Title')).toHaveValue('Untitled')
  await page.getByLabel('Title').fill('Glycolysis notes')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('Glycolysis splits glucose into two pyruvate molecules in the cytoplasm. '.repeat(4))
  await expect(page.getByText('Saved')).toBeVisible()
  await inBiology(page)
  await page.goto('/progress')
  const topics = page.getByRole('region', { name: 'Topics' })
  await topics.getByRole('button', { name: 'Draft topics' }).click()
  await topics.getByRole('button', { name: 'Save topics' }).click()
  await expect(page.getByText('Topics saved.')).toBeVisible()
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Midterm next fri')
  await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption({ label: 'Biology' })
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('exam')
  await page.getByLabel('Add a task').press('Enter')
  await expect(page.getByRole('checkbox', { name: 'Mark Midterm done' })).toBeVisible()
}

test('make a study plan from an exam, see today\'s sessions on Planner and Home, and tick one', async ({ page }) => {
  test.setTimeout(120_000)
  await readyForPlan(page)
  const panel = page.getByRole('region', { name: 'Study plan' })
  await panel.getByRole('button', { name: 'Make a study plan for Midterm' }).click()
  await panel.getByRole('radio', { name: /Deep dive/ }).click()
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await expect(panel.getByText(/Deep dive · 45 min a day · Midterm in/)).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Today' })).toBeVisible()
  const row = panel.getByRole('checkbox', { name: /^Mark (Learn|Warm-up|Revise): .* done$/ }).first()
  await expect(row).toBeVisible()
  await row.check()
  // The same day's list is on Home, with the tick kept
  await page.goto('/home')
  await expect(page.getByRole('checkbox', { name: /^Mark (Learn|Warm-up|Revise): .* done$/ }).first()).toBeChecked()
  // And it stays that way after a reload
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /^Mark (Learn|Warm-up|Revise): .* done$/ }).first()).toBeChecked()
})

test('a Warm-up makes a quiz and opens it', async ({ page }) => {
  test.setTimeout(120_000)
  await readyForPlan(page)
  const panel = page.getByRole('region', { name: 'Study plan' })
  await panel.getByRole('button', { name: 'Make a study plan for Midterm' }).click()
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await panel.getByRole('button', { name: 'Start warm-up' }).first().click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)
})

test('edit the plan, then delete it', async ({ page }) => {
  test.setTimeout(120_000)
  await readyForPlan(page)
  const panel = page.getByRole('region', { name: 'Study plan' })
  await panel.getByRole('button', { name: 'Make a study plan for Midterm' }).click()
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await expect(panel.getByText(/Balanced · 45 min a day/)).toBeVisible()
  await panel.getByRole('button', { name: 'Edit plan' }).click()
  await panel.getByRole('radio', { name: /Sprint/ }).click()
  await panel.getByLabel('Minutes a day').fill('30')
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await expect(panel.getByText(/Sprint · 30 min a day/)).toBeVisible()
  await panel.getByRole('button', { name: 'Delete plan' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(panel.getByRole('button', { name: 'Make a study plan for Midterm' })).toBeVisible()
})

test('a course with no topics is sent to Progress first', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Midterm next fri')
  await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption({ label: 'Biology' })
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('exam')
  await page.getByLabel('Add a task').press('Enter')
  const panel = page.getByRole('region', { name: 'Study plan' })
  await panel.getByRole('button', { name: 'Make a study plan for Midterm' }).click()
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await expect(panel.getByText(/Draft topics for Biology on Progress first/)).toBeVisible()
})
