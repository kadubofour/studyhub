import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { noteWithText, signUp } from './helpers'

test('notebooks: make one, move a note into it, filter, rename, delete (the note is kept)', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/notes')
  await page.getByRole('button', { name: 'New notebook' }).click()
  const dialog = page.getByRole('dialog', { name: 'New notebook' })
  await dialog.getByLabel('Name').fill('Biology')
  await dialog.getByRole('button', { name: 'Create' }).click()
  const bar = page.getByRole('radiogroup', { name: 'Notebook' })
  await expect(bar.getByRole('radio', { name: 'Biology (0)' })).toBeChecked()

  await bar.getByRole('radio', { name: /^All/ }).click()
  await page.getByRole('button', { name: /More actions for Krebs cycle/ }).click()
  await page.getByRole('menuitem', { name: /Move to notebook/ }).click()
  await page.getByRole('dialog', { name: 'Move to notebook' }).getByRole('button', { name: 'Biology' }).click()
  await expect(bar.getByRole('radio', { name: 'Biology (1)' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Krebs cycle/ })).toContainText('Biology')

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  await page.reload()
  await expect(page.getByRole('radiogroup', { name: 'Notebook' }).getByRole('radio', { name: 'Biology (1)' })).toBeVisible() // it was saved

  await page.getByRole('radiogroup', { name: 'Notebook' }).getByRole('radio', { name: /^Biology/ }).click()
  await page.getByRole('button', { name: 'Rename notebook' }).click()
  const rename = page.getByRole('dialog', { name: 'Rename notebook' })
  await rename.getByLabel('Name').fill('Biology year 1')
  await rename.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('radio', { name: 'Biology year 1 (1)' })).toBeChecked()

  await page.getByRole('button', { name: 'Delete notebook' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('radio', { name: /^Biology year 1/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Krebs cycle/ })).toBeVisible() // the note is kept
})

