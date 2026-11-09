import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { create, signUp } from './helpers'

const CELLS = path.join(__dirname, 'fixtures', 'cells.pdf')

test('a kept PDF is read inside the app, and Explain takes it to the tutor', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await create(page, 'Upload')
  await page.getByRole('dialog').getByLabel('File to upload').setInputFiles(CELLS)
  await page.getByRole('button', { name: /Just keep the file/ }).click()
  await page.getByRole('button', { name: 'Keep file' }).click()
  await expect(page).toHaveURL(/\/files\/[0-9a-f-]{36}$/)

  // drawn by the app from the private file, with its words selectable, and no browser viewer or link out
  const first = page.getByRole('group', { name: 'Page 1' })
  await expect(first.locator('canvas')).toBeAttached({ timeout: 30_000 })
  await expect(first.locator('.pdf-text span').filter({ hasText: 'Krebs' })).toBeAttached()
  await expect(page.getByText('Page 1 of 1')).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toHaveCount(0)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  // the question is waiting in a new chat: nothing is sent until the student presses Send
  await page.getByRole('button', { name: 'Explain page' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}/)
  const box = page.getByLabel('Message')
  await expect(box).toHaveValue(/Explain page 1 of cells\.pdf to me in plain words\. It says:\s+Cell biology The Krebs cycle makes ATP\./)
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/) // taken from the address, so a reload does not fill the box again

  await page.locator('form').filter({ has: box }).getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible() // the fake tutor's reply
  await expect(page.getByRole('link', { name: 'cells.pdf' })).toHaveAttribute('href', /\/files\/[0-9a-f-]{36}$/) // the tutor read the file itself
})

test('a PDF sent to the tutor opens inside the app', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await page.goto('/tutor')
  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  await page.getByLabel('Files to add').setInputFiles(CELLS)
  const bar = page.locator('form').filter({ has: page.getByLabel('Message') })
  await expect(bar.getByText('cells.pdf')).toBeVisible()
  await bar.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()

  await page.getByRole('list', { name: 'Attached' }).getByRole('button', { name: /cells\.pdf/ }).click()
  const view = page.getByRole('dialog', { name: 'cells.pdf' })
  await expect(view.getByRole('group', { name: 'Page 1' }).locator('canvas')).toBeAttached({ timeout: 30_000 })
  await view.getByRole('button', { name: 'Close' }).click()
  await expect(view).toHaveCount(0)
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/) // still in the chat
})
