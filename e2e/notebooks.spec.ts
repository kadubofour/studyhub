import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { noteWithText, signUp } from './helpers'

test('notebooks: make one, move a note into it, open its page, rename it, delete it (the note is kept)', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/notes')
  await page.getByRole('button', { name: 'New notebook' }).click()
  const dialog = page.getByRole('dialog', { name: 'New notebook' })
  await dialog.getByLabel('Name').fill('Cell biology')
  await dialog.getByRole('button', { name: 'Create' }).click()
  const shelf = page.getByRole('list', { name: 'Notebooks' })
  await expect(shelf.getByRole('link', { name: 'Open Cell biology, 0 notes' })).toBeVisible()

  await page.getByRole('button', { name: /More actions for Krebs cycle/ }).click()
  await page.getByRole('menuitem', { name: /Move to notebook/ }).click()
  await page.getByRole('dialog', { name: 'Move to notebook' }).getByRole('button', { name: 'Cell biology' }).click()
  await expect(shelf.getByRole('link', { name: 'Open Cell biology, 1 note' })).toBeVisible()

  await shelf.getByRole('link', { name: /Cell biology/ }).click()
  await expect(page).toHaveURL(/\/notebooks\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Cell biology' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Notes in Cell biology' }).getByRole('link', { name: /Krebs cycle/ })).toBeVisible()
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Cell biology' })).toBeVisible() // it was saved
  await page.getByRole('button', { name: 'Rename' }).click()
  const rename = page.getByRole('dialog', { name: 'Rename notebook' })
  await rename.getByLabel('Name').fill('Cells')
  await rename.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cells' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete notebook' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByRole('list', { name: 'Notebooks' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Krebs cycle/ })).toBeVisible() // the note is kept
})

test('Library: a note filed in a notebook lives inside it, and the notebook opens on its own page', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/library')
  await page.getByRole('button', { name: 'New notebook' }).click()
  const dialog = page.getByRole('dialog', { name: 'New notebook' })
  await dialog.getByLabel('Name').fill('Cell biology')
  await dialog.getByRole('button', { name: 'Create' }).click()
  const shelf = page.getByRole('list', { name: 'Notebooks' })
  await expect(shelf.getByRole('link', { name: 'Open Cell biology, 0 notes' })).toBeVisible()

  await page.getByRole('checkbox', { name: 'Select Krebs cycle' }).check()
  await page.getByRole('button', { name: 'Move to notebook' }).click()
  await page.getByRole('dialog', { name: 'Move to notebook' }).getByRole('button', { name: 'Cell biology' }).click()
  await expect(page.getByText('Moved 1 note to Cell biology.')).toBeVisible()
  await expect(shelf.getByRole('link', { name: 'Open Cell biology, 1 note' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Library items' }).getByRole('link', { name: /Krebs cycle/ })).toHaveCount(0) // inside the notebook now

  await shelf.getByRole('link', { name: /Cell biology/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cell biology' })).toBeVisible()
  await page.getByRole('link', { name: /Krebs cycle/ }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
})
