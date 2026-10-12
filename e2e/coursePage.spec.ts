import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

test('Course page: gathers a course material, and opens from Library', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/flashcards')
  await page.getByRole('button', { name: 'Create a deck' }).click()
  await page.getByLabel('Name').fill('Cells')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByText('Cells')).toBeVisible()

  await page.goto('/library')
  await page.getByRole('button', { name: 'Unsorted' }).click()
  await page.getByRole('checkbox', { name: 'Select all shown' }).check()
  await page.getByLabel('Move to').selectOption({ label: 'Biology' })
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(page.getByText('Moved 2 items.')).toBeVisible()

  await page.getByRole('button', { name: 'Biology', exact: true }).click()
  await page.getByRole('link', { name: 'Open course page' }).click()
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/, { timeout: 20_000 }) // the first visit compiles the page in the dev server
  await expect(page.getByRole('heading', { level: 1, name: 'Biology' })).toBeVisible()
  await expect(page.getByText('1 note · 1 deck')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Notes' }).getByRole('link', { name: /Krebs cycle/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Decks' }).getByRole('link', { name: /Cells/ })).toBeVisible()

  await page.reload() // read again, not just shown
  await expect(page.getByRole('heading', { level: 1, name: 'Biology' })).toBeVisible()
  await page.getByRole('link', { name: 'Open in Library' }).click()
  await expect(page.getByRole('link', { name: /Krebs cycle/ })).toBeVisible()
})

test('Course page: a course that does not exist says so', async ({ page }) => {
  await signUp(page)
  await page.goto('/courses/11111111-1111-4111-8111-111111111111')
  await expect(page.getByRole('heading', { name: 'Course not found' })).toBeVisible()
  await page.goto('/courses/not-an-id')
  await expect(page.getByRole('heading', { name: 'Course not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Go to Library' }).click()
  await expect(page).toHaveURL(/\/library$/)
})

test('Course page: asking the tutor opens a chat in the course', async ({ page }) => {
  await signUp(page)
  await page.goto('/progress')
  await page.getByRole('link', { name: 'Open course page' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Biology' })).toBeVisible()
  await page.getByRole('button', { name: 'Ask the tutor' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
})
