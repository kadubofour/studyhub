import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

const CARDS: [string, string][] = [['Mitochondria?', 'ATP'], ['Nucleus?', 'DNA'], ['Ribosome?', 'Protein'], ['Membrane?', 'Barrier']]

test('play Speed round and Match from a deck; the plays earn XP', async ({ page }) => {
  await signUp(page)
  await page.goto('/flashcards')
  await page.getByRole('button', { name: 'Create a deck' }).click()
  await page.getByLabel('Name').fill('Cells')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText('Cells').click()
  for (const [i, [f, b]] of CARDS.entries()) {
    if (i === 3) await expect(page.getByText('Add 4 cards to play games')).toBeVisible()
    await page.getByLabel('Front').fill(f)
    await page.getByLabel('Back').fill(b)
    await page.getByRole('button', { name: 'Add card' }).click()
    await expect(page.getByText(f)).toBeVisible()
  }
  await expect(page.getByText('Add 4 cards to play games')).toHaveCount(0)

  await page.getByRole('link', { name: 'Speed round' }).click()
  for (let n = 0; n < 4; n++) {
    await expect(page.getByText(`Question ${n + 1} of 4`)).toBeVisible()
    for (const [f, b] of CARDS) {
      if (await page.getByText(f, { exact: true }).isVisible()) { await page.getByRole('button', { name: b, exact: true }).click(); break }
    }
    await expect(page.getByText('Correct.')).toBeVisible()
    await page.getByRole('button', { name: n === 3 ? 'See results' : 'Next', exact: true }).click()
  }
  await expect(page.getByText('Score 4 / 4')).toBeVisible()
  await page.getByRole('link', { name: 'Back to deck' }).click()

  await page.getByRole('link', { name: 'Match' }).click()
  for (const [f, b] of CARDS) {
    await page.getByRole('group', { name: 'Terms' }).getByRole('button', { name: f }).click()
    await page.getByRole('group', { name: 'Meanings' }).getByRole('button', { name: b }).click()
  }
  await expect(page.getByText('Score 4 / 4')).toBeVisible()
  await expect(page.getByText('Could not save this play.')).toHaveCount(0)

  await page.goto('/home')
  await expect(page.getByText('+16 XP today')).toBeVisible()
  await expect(page.getByText('Level 1 · 16 XP')).toBeVisible()
})
