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
  await page.getByRole('radiogroup', { name: 'Move to' }).getByRole('radio', { name: 'Biology' }).click()
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

test('Course page: from Search or jump anywhere, and from Home on a phone', async ({ page, isMobile }) => {
  await signUp(page)
  if (isMobile) {
    await page.getByRole('list', { name: 'Your courses' }).getByRole('link', { name: /Biology/ }).click() // Home lists them on a phone
  } else {
    await page.getByRole('button', { name: 'Search or jump' }).click()
    await page.getByRole('combobox', { name: 'Search or jump' }).fill('biology')
    await expect(page.getByRole('option', { name: /Biology/ })).toHaveAttribute('aria-selected', 'true') // courses are read when the palette opens
    await page.keyboard.press('Enter')
  }
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Biology' })).toBeVisible()
})

test('Preferences are on the Profile page now, and Settings keeps Sign out', async ({ page }) => {
  await signUp(page)
  await page.goto('/profile')
  await page.getByLabel('Focus length (min)').fill('30')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Settings saved')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Focus length (min)')).toHaveValue('30')
  await page.goto('/settings?section=account')
  await expect(page.getByLabel('Focus length (min)')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
})
