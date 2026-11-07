import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { create, moveNoteToNotebook, noteWithText, openNewNotebook, signUp } from './helpers'

test('notebooks: make one, move a note into it, open its page, rename it, delete it (what is in it goes to General)', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await noteWithText(page, 'Krebs cycle') // a note made without choosing goes in General
  await page.goto('/library')
  const shelf = page.getByRole('list', { name: 'Notebooks' })
  await expect(shelf.getByRole('link', { name: 'General' })).toBeVisible()
  await openNewNotebook(page)
  const dialog = page.getByRole('dialog', { name: 'New notebook' })
  await dialog.getByLabel('Name').fill('Cell biology')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(shelf.getByRole('link', { name: 'Cell biology' })).toBeVisible()
  await expect(shelf.getByRole('listitem').filter({ hasText: 'Cell biology' })).toContainText('Empty')

  // the note's own page has the notebook it is in
  await shelf.getByRole('link', { name: 'General' }).click()
  await page.getByRole('link', { name: /Krebs cycle/ }).click()
  await moveNoteToNotebook(page, 'Cell biology')
  await page.getByRole('link', { name: 'Back to notebook' }).click() // back goes to the notebook it is in now
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
  await expect(page).toHaveURL(/\/courses\/(none|[0-9a-f-]{36})$/) // back to the course the notebook was in
  await expect(page.getByRole('list', { name: 'Notebooks' }).getByRole('link', { name: 'Cells' })).toHaveCount(0)
  await page.getByRole('list', { name: 'Notebooks' }).getByRole('link', { name: 'General' }).click()
  await expect(page.getByRole('link', { name: /Krebs cycle/ })).toBeVisible() // moved to General, not lost
})

test('a notebook is where things are started: a note, a deck, material, and a recording; nothing is left unsorted', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await page.goto('/library')
  await openNewNotebook(page)
  const dialog = page.getByRole('dialog', { name: 'New notebook' })
  await dialog.getByLabel('Name').fill('Chemistry')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('link', { name: 'Chemistry' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Chemistry' })).toBeVisible()
  await expect(page.getByText('Nothing in this notebook yet')).toBeVisible()

  // material: a file kept in this notebook
  await page.getByRole('button', { name: 'Materials', exact: true }).first().click()
  await page.getByRole('dialog').getByLabel('File to upload').setInputFiles({ name: 'periodic.md', mimeType: 'text/markdown', buffer: Buffer.from('# Periodic table\n\nElements in rows and columns.\n') })
  await page.getByRole('button', { name: /Just keep the file/ }).click()
  await page.getByRole('button', { name: 'Keep file' }).click()
  await expect(page.getByRole('list', { name: 'Materials in Chemistry' }).getByRole('link', { name: /periodic/ })).toBeVisible()

  // a deck, made here
  await page.getByRole('button', { name: /New deck/ }).click()
  await page.getByRole('dialog', { name: 'New deck' }).getByLabel('Name').fill('Elements')
  await page.getByRole('dialog', { name: 'New deck' }).getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/flashcards\/[0-9a-f-]{36}$/)
  await page.goBack()
  await expect(page.getByRole('list', { name: 'Decks in Chemistry' }).getByRole('link', { name: /Elements/ })).toBeVisible()

  // a note, made here, is in it; recording starts in it
  await page.getByRole('button', { name: 'New note', exact: true }).first().click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await page.getByRole('link', { name: 'Back to notebook' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Chemistry' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Record lecture/ })).toHaveAttribute('href', /\/lectures\/record\?notebook=[0-9a-f-]{36}$/)

  // and the Library cards say what is in them
  await page.goto('/library')
  await expect(page.getByRole('list', { name: 'Notebooks' }).getByRole('listitem').filter({ hasText: 'Chemistry' })).toContainText('1 note · 1 deck · 1 material')
  await create(page, 'New note') // made from the sidebar without choosing: General
  await page.goto('/library')
  await expect(page.getByRole('list', { name: 'Notebooks' }).getByRole('listitem').filter({ hasText: 'General' })).toContainText('1 note')
})
