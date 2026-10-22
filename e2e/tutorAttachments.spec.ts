import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUp } from './helpers'

// a 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

test('Tutor: add a photo and a file in the message bar, send them, and they stay with the question', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await page.goto('/tutor')
  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  const bar = page.locator('form').filter({ has: page.getByLabel('Message') })
  await expect(bar.getByRole('button', { name: 'Add files or photos' })).toBeVisible()
  await page.getByLabel('Files to add').setInputFiles([
    { name: 'question.png', mimeType: 'image/png', buffer: PNG },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Mitosis has four phases.') },
  ])
  const chips = bar.getByRole('list', { name: 'Files to send' })
  await expect(chips.getByText('question.png')).toBeVisible()
  await expect(chips.getByText('notes.txt')).toBeVisible()
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  await page.getByLabel('Message').fill('Where does this happen?')
  await bar.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
  await expect(chips).toHaveCount(0) // the bar is empty again
  const attached = page.getByRole('list', { name: 'Attached' })
  await expect(attached.getByRole('link', { name: /question\.png/ })).toBeVisible()
  await expect(attached.getByText('notes.txt')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('list', { name: 'Attached' }).getByRole('link', { name: /question\.png/ })).toBeVisible()
})

test('Tutor: a file that cannot be added is explained, and files can be sent without text', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await page.goto('/tutor')
  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  await page.getByLabel('Files to add').setInputFiles({ name: 'lecture.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('x') })
  await expect(page.getByText(/Audio and video can.t be added here/)).toBeVisible()
  await page.getByLabel('Files to add').setInputFiles({ name: 'question.png', mimeType: 'image/png', buffer: PNG })
  const bar = page.locator('form').filter({ has: page.getByLabel('Message') })
  await bar.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
})
