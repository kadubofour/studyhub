import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

test('Home: four quick actions for what has no tab, and course material is one tap away', async ({ page }) => {
  await signUp(page)
  // a note in Biology so there is material to jump back into
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/home')
  const actions = page.getByRole('group', { name: 'Quick actions' })
  await expect(actions).toBeVisible()
  await expect(actions.getByRole('button')).toHaveText([/Take a quiz/, /Upload/])
  await expect(actions.getByRole('link')).toHaveText([/Record lecture/, /Ask the tutor/])
  // What the tab bar already has is not repeated
  for (const n of ['New note', 'New deck', 'Scan']) await expect(actions.getByRole('button', { name: n })).toHaveCount(0)

  const courses = page.getByRole('list', { name: 'Your courses' }).last()
  await expect(courses.getByRole('link', { name: /Biology/ })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Jump back in' }).getByRole('link', { name: /Krebs cycle/ })).toBeVisible()

  await actions.getByRole('button', { name: /Upload/ }).click()
  await expect(page.getByRole('heading', { name: 'Upload material' })).toBeVisible()
  await page.keyboard.press('Escape')
  await actions.getByRole('link', { name: /Ask the tutor/ }).click()
  await expect(page).toHaveURL(/\/tutor/)
  await page.goBack()
  await page.getByRole('group', { name: 'Quick actions' }).getByRole('link', { name: /Record lecture/ }).click()
  await expect(page).toHaveURL(/\/lectures\/record/)
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
