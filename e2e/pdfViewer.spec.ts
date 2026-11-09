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

  // words selected in the PDF get the same button as words selected in a note, and asking about them goes straight to the tutor
  await first.locator('.pdf-text span').filter({ hasText: 'Krebs' }).evaluate(el => {
    const words = document.createRange()
    words.selectNodeContents(el)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(words)
  })
  await page.getByRole('button', { name: 'Ask the tutor to explain the selected text' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}/)
  await expect(page.getByText('Explain this from page 1 of “cells.pdf”, step by step, in simple terms', { exact: false })).toBeVisible()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible() // the fake tutor's reply, with nothing more pressed
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/, { timeout: 15_000 }) // taken from the address, so a reload does not ask again
  await expect(page.getByRole('link', { name: 'cells.pdf' })).toHaveAttribute('href', /\/files\/[0-9a-f-]{36}$/) // the tutor read the file itself

  // the whole page can be asked about too
  await page.goBack()
  await expect(page).toHaveURL(/\/files\/[0-9a-f-]{36}$/)
  await page.getByRole('button', { name: 'Explain page' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}/)
  await expect(page.getByText('Explain page 1 of “cells.pdf”, step by step, in simple terms', { exact: false })).toBeVisible()
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
