import { test, expect } from '@playwright/test'
import { create, noteWithText, openNewNotebook, signUp } from './helpers'

test('the Library opens on a shelf of notebooks; Create makes another; search looks inside notebooks', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle') // made without choosing a notebook: General
  await page.goto('/library')
  const shelf = page.getByRole('list', { name: 'Notebooks' })
  const general = shelf.getByRole('listitem').filter({ hasText: 'General' })
  await expect(general).toContainText('1 note')
  await expect(shelf.getByRole('progressbar')).toHaveCount(0) // no course cards, no progress bars

  await openNewNotebook(page)
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

test('the toolbar and a notebook card\'s menu: Materials, Create, rename and delete', async ({ page, isMobile }) => {
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
  await openNewNotebook(page)
  await page.getByRole('dialog', { name: 'New notebook' }).getByLabel('Name').fill('Temp')
  await page.getByRole('dialog', { name: 'New notebook' }).getByRole('button', { name: 'Create' }).click()
  // a notebook has its ⋮ button; a phone also opens the same menu when it is pressed and held (a right click)
  const options = async (name: string) => { if (isMobile) await page.getByRole('list', { name: 'Notebooks' }).getByRole('link', { name: new RegExp(name) }).click({ button: 'right' }); else await page.getByRole('button', { name: `Options for ${name}` }).click() }
  await options('Temp')
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.getByRole('dialog', { name: 'Rename notebook' }).getByLabel('Name').fill('Spare')
  await page.getByRole('dialog', { name: 'Rename notebook' }).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('list', { name: 'Notebooks' }).getByRole('link', { name: 'Spare' })).toBeVisible()
  await options('Spare')
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Notebooks' }).getByRole('link', { name: 'Spare' })).toHaveCount(0)
  await options('General')
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0) // General stays
})
