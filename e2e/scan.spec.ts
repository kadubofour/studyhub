import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

// A tiny PNG standing in for a phone photo of a page
const photo = (name: string) => ({
  name, mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
})

test('scan photos into a note: reorder, read, scan again, save', async ({ page }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Scan' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Make')).toHaveValue('note')
  await dialog.getByLabel('Images or a PDF to scan').setInputFiles([photo('p1.png'), photo('p2.png')])
  await dialog.getByRole('button', { name: 'Move page 2 earlier' }).click()
  await dialog.getByRole('button', { name: '✦ Scan 2 pages' }).click()
  await expect(dialog.getByLabel('Title')).toHaveValue('Fake note', { timeout: 20_000 })
  await dialog.getByRole('button', { name: '↺ Scan again' }).click()
  await dialog.getByRole('button', { name: '✦ Scan 2 pages' }).click() // the same pages are still there
  await dialog.getByRole('button', { name: 'Save note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await expect(page.getByLabel('Title')).toHaveValue('Fake note')
})

test('scan pages into flashcards and save them to a new deck', async ({ page }) => {
  await signUp(page)
  await page.goto('/flashcards')
  await page.getByRole('button', { name: 'Scan' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Make')).toHaveValue('cards')
  await dialog.getByLabel('Images or a PDF to scan').setInputFiles([photo('cards.png')])
  await dialog.getByRole('button', { name: '✦ Scan 1 page' }).click()
  await expect(dialog.getByText(/2 cards found/)).toBeVisible({ timeout: 20_000 })
  await dialog.getByLabel('New deck name').fill('Cells')
  await dialog.getByRole('button', { name: 'Save 2 cards' }).click()
  await expect(page.getByText('Saved 2 cards.')).toBeVisible()
  await expect(page.getByText('Cells')).toBeVisible()
})

test('scan a timetable into tasks and classes, matching and creating courses', async ({ page }) => {
  await signUp(page) // onboarding made the course "Biology"
  await page.goto('/planner')
  await page.getByRole('button', { name: 'Scan' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Images or a PDF to scan').setInputFiles([photo('timetable.png')])
  await dialog.getByRole('button', { name: '✦ Scan 1 page' }).click()
  await expect(dialog.getByText('check this')).toHaveCount(2, { timeout: 20_000 })
  await expect(dialog.getByLabel('Class 1 course').locator('option:checked')).toHaveText('Biology')
  await expect(dialog.getByLabel('Class 2 course').locator('option:checked')).toHaveText('Create course Chemistry')
  await dialog.getByLabel('Keep task 2').uncheck()
  await dialog.getByRole('button', { name: 'Save 3 items' }).click()
  await expect(page.getByText('Added 1 task and 2 classes.')).toBeVisible()
  await expect(page.getByText('Cell biology essay')).toBeVisible()
  await expect(page.getByText('Chemistry').first()).toBeVisible()
})
