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

test('find resources for a topic, keep them across a reload, and remove one', async ({ page }) => {
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

  await topics.getByRole('button', { name: 'Resources for Krebs cycle' }).click()
  await expect(topics.getByText('No links yet.')).toBeVisible()
  await topics.getByRole('button', { name: 'Find resources' }).click()
  const video = topics.getByRole('link', { name: 'The Krebs cycle explained' })
  await expect(video).toBeVisible()
  await expect(video).toHaveAttribute('target', '_blank')
  await expect(topics.getByRole('link', { name: 'Krebs cycle on Khan Academy' })).toBeVisible()

  await page.reload()
  await page.getByRole('region', { name: 'Topics' }).getByRole('button', { name: 'Resources for Krebs cycle' }).click()
  await expect(page.getByRole('link', { name: 'The Krebs cycle explained' })).toBeVisible()

  await page.getByRole('button', { name: 'Remove The Krebs cycle explained' }).click()
  await expect(page.getByRole('link', { name: 'The Krebs cycle explained' })).toHaveCount(0)
  await page.reload()
  await page.getByRole('region', { name: 'Topics' }).getByRole('button', { name: 'Resources for Krebs cycle' }).click()
  await expect(page.getByRole('link', { name: 'Krebs cycle on Khan Academy' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'The Krebs cycle explained' })).toHaveCount(0)
})
