import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

async function askFromNote(page: import('@playwright/test').Page) {
  await signUp(page)
  await noteWithText(page)
  await page.getByRole('button', { name: 'Ask the tutor' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
}
async function say(page: import('@playwright/test').Page, text: string) {
  await page.getByLabel('Message').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test('ask the tutor about a note: a streamed reply that names its source', async ({ page }) => {
  await askFromNote(page)
  await expect(page.getByText('About').first()).toBeVisible()
  await say(page, 'Where does it happen?')
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
  await expect(page.getByText('From:')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Krebs cycle' }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByText('Where does it happen?')).toBeVisible()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
})

test('the tutor proposes flashcards, the student edits one and adds them', async ({ page }) => {
  await askFromNote(page)
  await say(page, 'Make flashcards on this')
  await expect(page.getByText('2 flashcards for “Krebs tutor deck”')).toBeVisible()
  await page.getByLabel('Card 1 front').fill('Where does the Krebs cycle run?')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('link', { name: 'Open' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Open' })).toBeVisible() // still added after a reload
  await page.goto('/flashcards')
  await page.getByRole('link', { name: /Krebs tutor deck/ }).click()
  await expect(page.getByText('Where does the Krebs cycle run?')).toBeVisible()
})

test('discarding a proposal saves nothing', async ({ page }) => {
  await askFromNote(page)
  await say(page, 'Make flashcards on this')
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByText('Discarded')).toBeVisible()
  await page.goto('/flashcards')
  await expect(page.getByText('Krebs tutor deck')).toHaveCount(0)
})

test('a free-standing chat appears in the Tutor list and reopens', async ({ page }) => {
  await signUp(page)
  await page.goto('/tutor')
  await expect(page.getByText(/No chats yet/)).toBeVisible()
  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  await say(page, 'Explain the mitochondrial matrix')
  await expect(page.getByText('mitochondrial matrix').first()).toBeVisible()
  // The heading takes the first message's words once the server has finished saving the reply
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explain the mitochondrial matrix')
  await page.goto('/tutor')
  await page.getByRole('link', { name: /Explain the mitochondrial matrix/ }).click()
  await expect(page.getByText('Explain the mitochondrial matrix').first()).toBeVisible()
})
