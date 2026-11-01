import { test, expect } from '@playwright/test'
import { noteWithText, openLibraryMaterials, signUp, inBiology } from './helpers'

test('Library opens on a card for each course; New course adds one, search finds it, Materials lists everything', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await inBiology(page)
  await page.goto('/library')

  // a card for the first course: how far through it, what it holds, when it was last worked on, its plan
  const courses = page.getByRole('list', { name: 'Courses' })
  const biology = courses.getByRole('listitem').filter({ hasText: 'Biology' })
  await expect(biology.getByRole('progressbar', { name: 'Progress in Biology' })).toBeVisible()
  await expect(biology).toContainText('1 material')
  await expect(biology).toContainText(/Last studied/)
  await expect(biology).toContainText("You haven't started a study plan yet")

  // a new course, from the dashed card
  await page.getByRole('button', { name: /^New course/ }).click()
  const dialog = page.getByRole('dialog', { name: 'New course' })
  await dialog.getByLabel('Name').fill('Chemistry')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(courses.getByRole('listitem').filter({ hasText: 'Chemistry' })).toBeVisible()

  // search narrows the cards
  await page.getByLabel('Search courses').fill('chem')
  await expect(courses.getByRole('listitem').filter({ hasText: 'Biology' })).toHaveCount(0)
  await page.getByLabel('Search courses').fill('zzz')
  await expect(page.getByText('No course matches')).toBeVisible()
  await page.getByLabel('Search courses').fill('')

  // a card opens its course page
  await courses.getByRole('link', { name: 'Biology' }).click()
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Biology' })).toBeVisible()

  // Materials is everything in one list, and Courses comes back to the cards
  await openLibraryMaterials(page)
  await expect(page.getByRole('region', { name: 'Library items' }).getByRole('link', { name: /Krebs cycle/ })).toBeVisible()
})

test('the Library toolbar makes a notebook, and a course card\'s menu shows its materials', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await inBiology(page)
  await page.goto('/library')
  await page.getByRole('button', { name: 'New notebook', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New notebook' })
  await dialog.getByLabel('Name').fill('Cell biology')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('list', { name: 'Notebooks' }).getByRole('link', { name: 'Open Cell biology, 0 notes' })).toBeVisible()

  await page.getByRole('button', { name: 'Options for Biology' }).click()
  await page.getByRole('menuitem', { name: 'See its materials' }).click()
  await expect(page.getByRole('region', { name: 'Library items' }).getByRole('link', { name: /Krebs cycle/ })).toBeVisible()
})
