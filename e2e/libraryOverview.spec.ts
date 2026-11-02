import { test, expect } from '@playwright/test'
import { create, noteWithText, signUp } from './helpers'

test('the Library opens on a card for each notebook; a small card makes another; search looks inside notebooks', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle') // made without choosing a notebook: General
  await page.goto('/library')
  const shelf = page.getByRole('list', { name: 'Notebooks' })
  const general = shelf.getByRole('listitem').filter({ hasText: 'General' })
  await expect(general).toContainText('1 note')
  await expect(general).toContainText('Last updated')
  await expect(shelf.getByRole('progressbar')).toHaveCount(0) // no course cards, no progress bars
  await expect(page.getByRole('button', { name: 'Create new notebook' })).toBeVisible()

  await page.getByRole('button', { name: 'Create new notebook' }).click()
  const dialog = page.getByRole('dialog', { name: 'New notebook' })
  await dialog.getByLabel('Name').fill('Chemistry')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(shelf.getByRole('listitem').filter({ hasText: 'Chemistry' })).toContainText('Empty')

  // search narrows the notebooks, and finds what is inside them
  await page.getByLabel('Search notebooks').fill('chem')
  await expect(shelf.getByRole('listitem').filter({ hasText: 'General' })).toHaveCount(0)
  await page.getByLabel('Search notebooks').fill('krebs')
  await expect(page.getByRole('region', { name: 'Found in your notebooks' }).getByRole('link', { name: /Krebs cycle/ })).toContainText('in General')
  await page.getByLabel('Search notebooks').fill('zzz')
  await expect(page.getByText(/Nothing matches/)).toBeVisible()
})

test('the toolbar and a notebook card\'s menu: Materials, Create, rename and delete', async ({ page }) => {
  await signUp(page)
  await create(page, 'New note')
  await page.goto('/library')
  // Materials adds raw study material
  await page.getByRole('button', { name: 'Materials', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('File to upload')).toBeAttached()
  await page.keyboard.press('Escape')
  // Create is a menu of what to make
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Create' }).getByRole('menuitem', { name: 'New note', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  // a made notebook can be renamed and deleted from its card
  await page.getByRole('button', { name: 'Create new notebook' }).click()
  await page.getByRole('dialog', { name: 'New notebook' }).getByLabel('Name').fill('Temp')
  await page.getByRole('dialog', { name: 'New notebook' }).getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'Options for Temp' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.getByRole('dialog', { name: 'Rename notebook' }).getByLabel('Name').fill('Spare')
  await page.getByRole('dialog', { name: 'Rename notebook' }).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('list', { name: 'Notebooks' }).getByRole('link', { name: 'Spare' })).toBeVisible()
  await page.getByRole('button', { name: 'Options for Spare' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Notebooks' }).getByRole('link', { name: 'Spare' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Options for General' }).click()
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0) // General stays
})
