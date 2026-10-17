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
  await expect(page.getByRole('button', { name: /Show answer.*space/ })).toHaveCount(0)
  await page.getByLabel('Your answer').fill('something I half remember')
  await page.keyboard.press('Enter')
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  await expect(page.getByText(/^(Correct|Close|Not quite)$/)).toBeVisible()
  await expect(page.getByText('You wrote')).toBeVisible()
  await expect(page.getByText(/^Suggested: (Again|Hard|Good)$/)).toBeVisible()
  await page.keyboard.press('3') // the usual keys rate after checking
  await expect(page.getByLabel('Your answer').or(page.getByText(/Session complete/))).toBeVisible()

  await page.reload()
  await expect(page.getByRole('radio', { name: 'Type answer' })).toHaveAttribute('aria-checked', 'true')
})

test('review: practise cards that are not due, without touching the schedule', async ({ page }) => {
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
  // review every due card: now nothing is due
  const show = page.getByRole('button', { name: /Show answer.*space/ })
  const done = page.getByText('Session complete')
  for (let i = 0; i < 10; i++) {
    await expect(show.or(done)).toBeVisible()
    if (await done.isVisible()) break
    await show.click()
    await page.keyboard.press('4')
  }
  await expect(page.getByText('Session complete')).toBeVisible()
  await page.getByRole('link', { name: 'Practise these cards' }).click()
  await expect(page.getByText(/schedule won.t change/)).toBeVisible()
  await page.getByRole('button', { name: /Show answer.*space/ }).click()
  await page.keyboard.press('3')
  await page.goto('/review')
  await expect(page.getByText('Nothing due right now')).toBeVisible() // practising changed nothing
})
