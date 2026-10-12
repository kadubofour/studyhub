import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

test('Library: find loose material under Unsorted, move it into a course, and see it there', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/flashcards')
  await page.getByRole('button', { name: 'Create a deck' }).click()
  await page.getByLabel('Name').fill('Cells')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByText('Cells')).toBeVisible()

  await page.goto('/library')
  await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible()
  const list = page.getByRole('list').filter({ has: page.getByRole('link', { name: /Krebs cycle/ }) })
  await expect(list.getByRole('link', { name: /Krebs cycle/ })).toBeVisible()
  await expect(list.getByRole('link', { name: /Cells/ })).toBeVisible()

  await page.getByRole('button', { name: 'Unsorted' }).click()
  await expect(page.getByText('2 items')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Select all shown' }).check()
  await expect(page.getByText('2 selected')).toBeVisible()
  await page.getByLabel('Move to').selectOption({ label: 'Biology' })
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(page.getByText('Moved 2 items.')).toBeVisible()
  await expect(page.getByText('Everything is in a course.')).toBeVisible()

  await page.getByRole('button', { name: 'Biology', exact: true }).click()
  await expect(page.getByRole('link', { name: /Krebs cycle/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Cells/ })).toBeVisible()

  await page.reload() // saved, not just shown
  await page.getByRole('button', { name: 'Biology', exact: true }).click()
  await expect(page.getByRole('link', { name: /Krebs cycle/ })).toBeVisible()
})

test('Library opens on a course named in the address, and a new student sees an invitation', async ({ page }) => {
  await signUp(page)
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Your library starts here' })).toBeVisible()
  await noteWithText(page, 'Enzymes')
  await page.goto('/library?course=none')
  await expect(page.getByRole('link', { name: /Enzymes/ })).toBeVisible()
  await page.getByRole('link', { name: /Enzymes/ }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
})

test('Profile: shows who and how far, and the school, programme and colour can be changed', async ({ page, isMobile }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/profile')
  await expect(page.getByRole('heading', { level: 1, name: 'Ama' })).toBeVisible()
  await expect(page.getByText('Free plan')).toBeVisible()
  const totals = page.getByRole('list', { name: 'Study totals' })
  await expect(totals.getByText('Notes').locator('xpath=ancestor::li')).toContainText('1')
  await expect(page.getByText('1 of 12 badges earned')).toBeVisible() // the first note
  await expect(page.getByRole('list', { name: 'Badges' }).getByText('First note').locator('xpath=ancestor::li')).toContainText('Earned')

  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByLabel('School').fill('KNUST')
  await page.getByLabel('Programme').fill('Pharmacy')
  await page.getByRole('radio', { name: '#BE185D' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Pharmacy · KNUST')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Pharmacy · KNUST')).toBeVisible()
  await expect(page.getByTestId('avatar').first()).toHaveCSS('background-color', 'rgb(190, 24, 93)')
  if (!isMobile) {
    const chip = page.getByRole('link', { name: 'Ama', exact: true })
    await expect(chip).toHaveAttribute('href', '/profile')
  }
})

test('the Library and Profile are reachable from the sidebar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sidebar is for wider screens')
  await signUp(page)
  await page.getByRole('link', { name: 'Library' }).first().click()
  await expect(page).toHaveURL(/\/library$/)
  await page.getByRole('link', { name: 'Ama', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
})
