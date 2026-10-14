import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

test('Home: quick actions start a note and a deck, and course material is one tap away', async ({ page }) => {
  await signUp(page)
  // a note in Biology so there is material to jump back into
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/home')
  await expect(page.getByRole('group', { name: 'Quick actions' })).toBeVisible()

  const courses = page.getByRole('list', { name: 'Your courses' }).last()
  await expect(courses.getByRole('link', { name: /Biology/ })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Jump back in' }).getByRole('link', { name: /Krebs cycle/ })).toBeVisible()

  await page.getByRole('link', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/flashcards\?new=1/)
  await expect(page.getByRole('heading', { name: 'New deck' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/home')
  await page.getByRole('button', { name: 'New note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/, { timeout: 20_000 })
})

test('Home: a course card opens the course page, which can start a deck for that course', async ({ page }) => {
  await signUp(page)
  await page.goto('/home')
  await page.getByRole('list', { name: 'Your courses' }).last().getByRole('link', { name: /Biology/ }).click()
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  await page.getByRole('link', { name: 'New deck' }).click()
  await expect(page.getByRole('heading', { name: 'New deck' })).toBeVisible()
  await expect(page.getByRole('dialog').getByLabel('Course')).toHaveValue(/.+/) // the course is already chosen
})

test('Progress has quick actions, and no lines between the stats', async ({ page }) => {
  await signUp(page)
  await page.goto('/progress')
  const actions = page.getByRole('group', { name: 'Quick actions' })
  await expect(actions.getByRole('link', { name: 'Start focus' })).toBeVisible()
  await expect(actions.getByRole('link', { name: 'Review cards' })).toBeVisible()
  const border = await page.getByRole('list', { name: 'Study stats' }).evaluate(el => getComputedStyle(el).borderTopWidth)
  expect(border).toBe('0px')
})
