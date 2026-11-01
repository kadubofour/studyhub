import { test, expect } from '@playwright/test'

test('setup: a programme brings suggested courses, and starter topics with notes are drafted for the ones kept', async ({ page }) => {
  test.setTimeout(150_000)
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Ama')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Confirm email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByLabel('School').fill('University of Ghana')
  await page.getByLabel('Programme').fill('BSc Biology')
  await page.getByRole('button', { name: 'Continue' }).click()

  // the courses suggested for the programme, all ticked
  const list = page.getByRole('list', { name: 'Suggested courses' })
  await expect(list.getByRole('checkbox')).toHaveCount(3)
  await list.getByRole('checkbox', { name: 'Biochemistry' }).uncheck()
  await page.getByLabel('Add a course').fill('Biostatistics')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add 3 courses' })).toBeVisible()
  await page.getByRole('button', { name: 'Add 3 courses' }).click()

  // each course is made, then its topics and notes
  await expect(page.getByRole('heading', { name: '3 courses added' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('4 topics with notes').first()).toBeVisible()
  await expect(page.getByText(/drafts written by the AI/)).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/home/)

  // the notes are in the Library, each saying it is a draft, and the topics are on Progress
  await page.goto('/library')
  await page.getByRole('button', { name: /^Notes/ }).click()
  await expect(page.getByRole('link', { name: /Cell structure/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Cell structure/ }).first()).toContainText('Starter note drafted by the AI')
  await page.goto('/progress')
  await expect(page.getByRole('region', { name: 'Topics' }).getByText('Cell structure')).toBeVisible()
})

test('Courses has From my programme, which suggests courses again for a student already set up', async ({ page }) => {
  test.setTimeout(120_000)
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Ama')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Confirm email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page).toHaveURL(/\/home/)
  await page.goto('/courses')
  await page.getByRole('button', { name: 'From my programme' }).click()
  await page.getByRole('textbox', { name: 'Programme' }).fill('BSc Biology')
  await page.getByRole('button', { name: 'Find my courses' }).click()
  await expect(page.getByRole('list', { name: 'Suggested courses' }).getByRole('checkbox')).toHaveCount(3)
  await page.getByRole('switch', { name: /Write starter notes/ }).click() // the courses only
  await page.getByRole('button', { name: 'Add 3 courses' }).click()
  await expect(page.getByRole('heading', { name: '3 courses added' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('list', { name: 'Your courses' }).getByRole('link', { name: /Genetics/ })).toBeVisible()
})
