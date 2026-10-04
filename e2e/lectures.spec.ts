import { test, expect, type Page } from '@playwright/test'
import { signUp, becomePremium } from './helpers'

// Parts are 3 seconds in E2E (NEXT_PUBLIC_LECTURE_PART_SECONDS), so 7 seconds is 3 parts
async function record(page: Page, title: string, transcript: 'None' | 'Accurate, after recording', seconds = 7) {
  await page.goto('/lectures/record')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel(transcript).check()
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByLabel('Recording time')).toHaveText(`0:0${seconds}`, { timeout: (seconds + 10) * 1000 })
}

test('record, save, play and seek; Free students are told accurate transcripts are Premium', async ({ page }) => {
  await signUp(page)
  await record(page, 'Cell biology', 'None')
  await page.getByRole('button', { name: 'Stop & save' }).click()
  await expect(page).toHaveURL(/\/lectures\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Cell biology' })).toBeVisible()
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.getByRole('button', { name: '↻ Get accurate transcript' }).click()
  await expect(page.getByText('This is a Premium feature')).toBeVisible()
  await page.goto('/lectures')
  await expect(page.getByRole('link', { name: /Cell biology/ })).toBeVisible()
})

test('Premium: accurate transcript part by part, tap a line to seek, make a note', async ({ page }) => {
  await signUp(page)
  await becomePremium(page)
  await record(page, 'Krebs cycle', 'Accurate, after recording')
  await page.getByRole('button', { name: 'Stop & save' }).click()
  await expect(page.getByText('Accurate transcript')).toBeVisible({ timeout: 30_000 })
  const lines = page.getByRole('button', { name: /Welcome to the lecture/ })
  await expect(lines).toHaveCount(3) // one per part, timed from each part's start
  await lines.nth(2).click()
  await expect(page.getByLabel('Position')).not.toHaveValue('0')
  await page.getByRole('button', { name: '✦ Make a note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  await expect(page.getByLabel('Title')).toHaveValue('Fake note')
  await page.goBack()
  await expect(page.getByRole('link', { name: 'Open note' })).toBeVisible()
})

test('a recording interrupted by a reload is recovered from the device', async ({ page }) => {
  await signUp(page)
  await record(page, 'Interrupted', 'None', 5)
  await page.reload()
  await page.goto('/lectures')
  await page.getByRole('button', { name: 'Recover unsaved recording' }).click()
  await expect(page).toHaveURL(/\/lectures\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Interrupted' })).toBeVisible()
})

test('delete a lecture', async ({ page }) => {
  await signUp(page)
  await record(page, 'To delete', 'None', 2)
  await page.getByRole('button', { name: 'Stop & save' }).click()
  await expect(page.getByRole('heading', { name: 'To delete' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Delete lecture' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/lectures$/)
  await expect(page.getByRole('link', { name: /To delete/ })).toHaveCount(0)
})
