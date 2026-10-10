import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

async function askFromNote(page: import('@playwright/test').Page) {
  await signUp(page)
  await noteWithText(page)
  await page.getByRole('button', { name: 'Ask the tutor' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
}

test('guided mode is remembered, and its buttons appear only once the chat has begun', async ({ page }) => {
  await askFromNote(page)
  const guided = page.getByRole('switch', { name: 'Guided' })
  await expect(guided).toHaveAttribute('aria-checked', 'false')
  await Promise.all([page.waitForResponse(r => r.url().includes('/rest/v1/tutor_chats') && r.request().method() === 'PATCH'), guided.click()])
  await expect(guided).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toHaveCount(0) // nothing said yet
  await page.getByLabel('Message').fill('Where does the Krebs cycle happen?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Guided' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Show the answer' })).toBeVisible()
})

test('Give me a hint sends the request and gets a reply; turning guided off removes the buttons', async ({ page }) => {
  await askFromNote(page)
  const guided = page.getByRole('switch', { name: 'Guided' })
  await Promise.all([page.waitForResponse(r => r.url().includes('/rest/v1/tutor_chats') && r.request().method() === 'PATCH'), guided.click()])
  await page.getByLabel('Message').fill('Where does it happen?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
  await page.getByLabel('Message').fill('half typed')
  await page.getByRole('button', { name: 'Give me a hint' }).click()
  await expect(page.getByText('Give me a hint.')).toBeVisible()
  await expect(page.getByLabel('Message')).toHaveValue('half typed')
  await expect(page.getByText('mitochondrial matrix')).toHaveCount(2) // a second reply arrived
  await Promise.all([page.waitForResponse(r => r.url().includes('/rest/v1/tutor_chats') && r.request().method() === 'PATCH'), guided.click()])
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toHaveCount(0)
})
