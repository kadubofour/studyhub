import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { noteWithText, signUp } from './helpers'

test('review: answer a flashcard by typing, get it checked, rate it, and the choice is remembered', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.getByRole('button', { name: '✦ Study' }).click()
  const study = page.getByRole('complementary', { name: 'Study' })
  await study.getByRole('tab', { name: 'Cards' }).click()
  await study.getByRole('button', { name: '✦ Make flashcards' }).click()
  await study.getByRole('button', { name: /^Save \d+ cards?$/ }).click()
  await expect(page.getByText(/^Saved \d+ cards?\.$/)).toBeVisible()

  await page.goto('/review')
  await page.getByRole('radio', { name: 'Type answer' }).click()
  await expect(page.getByRole('button', { name: /Show answer/ })).toHaveCount(0)
  await page.getByLabel('Your answer').fill('something I half remember')
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByText(/^(Correct|Close|Not quite)$/)).toBeVisible()
  await expect(page.getByText('You wrote')).toBeVisible()
  await expect(page.getByRole('button', { name: /suggested/ })).toHaveCount(1)
  await page.keyboard.press('3') // the usual keys rate after checking
  await expect(page.getByLabel('Your answer').or(page.getByText(/Session complete/))).toBeVisible()

  await page.reload()
  await expect(page.getByRole('radio', { name: 'Type answer' })).toHaveAttribute('aria-checked', 'true')
})
