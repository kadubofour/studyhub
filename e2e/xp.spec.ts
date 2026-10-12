import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

test('a new student starts at level 1; ticking a task and finishing a quiz earn XP on Home and Progress', async ({ page }) => {
  await signUp(page)
  const bar = page.getByRole('banner', { name: 'Today at a glance' }).getByRole('progressbar', { name: 'Progress to level 2' })
  await expect(page.getByRole('banner', { name: 'Today at a glance' }).getByText('Level 1')).toBeVisible()
  await expect(bar).toHaveAttribute('aria-valuetext', '0 of 50 XP')

  await page.getByLabel('Add a task').fill('Read chapter 4')
  await page.getByLabel('Add a task').press('Enter')
  await page.getByLabel('Mark Read chapter 4 done').check()

  await noteWithText(page)
  await page.getByRole('button', { name: '✦ Study' }).click()
  const study = page.getByRole('complementary', { name: 'Study' })
  await study.getByRole('tab', { name: 'Quiz' }).click()
  await study.getByRole('button', { name: '✦ New quiz' }).click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)
  await page.getByRole('button', { name: 'Mitochondrial matrix' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'True' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('nadh')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('acetyl coenzyme A')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByText('3 / 4')).toBeVisible()

  await page.goto('/home')
  await expect(bar).toHaveAttribute('aria-valuetext', '15 of 50 XP')

  await page.goto('/progress')
  const xp = page.locator('section', { has: page.getByRole('heading', { name: 'XP', exact: true }) })
  await expect(xp.getByText('Level 1')).toBeVisible()
  await expect(xp.getByText('15 XP', { exact: true })).toBeVisible()
  await expect(xp.getByText('15 of 50 XP to level 2')).toBeVisible()
})
