import { test, expect, type Page } from '@playwright/test'
import { newNoteFromNote, noteWithText, signUp } from './helpers'

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
  await newNoteFromNote(page)
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
  const video = topics.getByRole('link', { name: 'Krebs cycle: full explanation' })
  await expect(video).toBeVisible()
  await expect(video).toHaveAttribute('target', '_blank')
  await expect(topics.getByText('Bio Explained')).toBeVisible()
  await expect(topics.getByText('12 min')).toBeVisible()
  await expect(topics.getByRole('link', { name: 'Krebs cycle on Khan Academy' })).toBeVisible()
  await expect(topics.getByRole('link', { name: 'Krebs cycle in 60 seconds' })).toHaveCount(0) // too short for the video filter
  await expect(topics.getByRole('link', { name: 'The Krebs cycle explained' })).toHaveCount(0) // the web search video is replaced

  await page.reload()
  await page.getByRole('region', { name: 'Topics' }).getByRole('button', { name: 'Resources for Krebs cycle' }).click()
  await expect(page.getByRole('link', { name: 'Krebs cycle: full explanation' })).toBeVisible()

  await page.getByRole('button', { name: 'Remove Krebs cycle: full explanation' }).click()
  await expect(page.getByRole('link', { name: 'Krebs cycle: full explanation' })).toHaveCount(0)
  await page.reload()
  await page.getByRole('region', { name: 'Topics' }).getByRole('button', { name: 'Resources for Krebs cycle' }).click()
  await expect(page.getByRole('link', { name: 'Krebs cycle on Khan Academy' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Krebs cycle: full explanation' })).toHaveCount(0)
})
