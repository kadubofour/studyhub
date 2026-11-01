import { test, expect } from '@playwright/test'
import { noteWithText, signUp, askTutorAboutNote, chatOption } from './helpers'

// A computer has the Guided switch by the message box; a phone has Guided in the Chat options menu, ticked when on
const onPhone = async (page: import('@playwright/test').Page) => (page.viewportSize()?.width ?? 1280) < 768
async function toggleGuided(page: import('@playwright/test').Page) {
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/rest/v1/tutor_chats') && r.request().method() === 'PATCH'),
    (await onPhone(page)) ? chatOption(page, 'Guided') : page.getByRole('switch', { name: 'Guided' }).click(),
  ])
}

async function askFromNote(page: import('@playwright/test').Page) {
  await signUp(page)
  await noteWithText(page)
  await askTutorAboutNote(page)
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
}

test('guided mode is remembered, and its buttons appear only once the chat has begun', async ({ page }) => {
  await askFromNote(page)
  const guided = page.getByRole('switch', { name: 'Guided' }) // a phone has no switch: its menu ticks Guided
  const computer = await guided.isVisible()
  if (computer) await expect(guided).toHaveAttribute('aria-checked', 'false')
  await toggleGuided(page)
  if (computer) await expect(guided).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toHaveCount(0) // nothing said yet
  await page.getByLabel('Message').fill('Where does the Krebs cycle happen?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible()
  await page.reload()
  if (computer) await expect(guided).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Show the answer' })).toBeVisible()
})

test('Give me a hint sends the request and gets a reply; turning guided off removes the buttons', async ({ page }) => {
  await askFromNote(page)
  await toggleGuided(page)
  await page.getByLabel('Message').fill('Where does it happen?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
  await page.getByLabel('Message').fill('half typed')
  await page.getByRole('button', { name: 'Give me a hint' }).click()
  await expect(page.getByText('Give me a hint.')).toBeVisible()
  await expect(page.getByLabel('Message')).toHaveValue('half typed')
  await expect(page.getByText('mitochondrial matrix')).toHaveCount(2) // a second reply arrived
  await toggleGuided(page)
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toHaveCount(0)
})
