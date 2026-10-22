import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

test('Home on a phone: quick actions for what is nowhere else, and course material is one tap away', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a wider screen has these in the sidebar')
  await signUp(page)
  // a note in Biology so there is material to jump back into
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/home')
  const actions = page.getByRole('group', { name: 'Quick actions' })
  await expect(actions).toBeVisible()
  await expect(actions.getByRole('button')).toHaveText([/Take a quiz/])
  await expect(actions.getByRole('link')).toHaveText([/Ask the tutor/])
  // What the Create button already makes is not repeated
  for (const n of ['New note', 'New deck', 'Scan', 'Upload']) await expect(actions.getByRole('button', { name: n })).toHaveCount(0)

  const courses = page.getByRole('list', { name: 'Your courses' }).last()
  await expect(courses.getByRole('link', { name: /Biology/ })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Jump back in' }).getByRole('link', { name: /Krebs cycle/ })).toBeVisible()

  await actions.getByRole('link', { name: /Ask the tutor/ }).click()
  await expect(page).toHaveURL(/\/tutor/)
})

test('Home on a phone: a course card opens the course page, which can start a deck for that course', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a wider screen has the courses in the sidebar')
  await signUp(page)
  await page.goto('/home')
  await page.getByRole('list', { name: 'Your courses' }).last().getByRole('link', { name: /Biology/ }).click()
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  await page.getByRole('link', { name: 'New deck' }).click()
  await expect(page.getByRole('heading', { name: 'New deck' })).toBeVisible()
  await expect(page.getByRole('dialog').getByLabel('Course')).toHaveValue(/.+/) // the course is already chosen
})

test('Progress has quick actions on a phone only, and no lines between the stats', async ({ page, isMobile }) => {
  await signUp(page)
  await page.goto('/progress')
  const actions = page.getByRole('group', { name: 'Quick actions' })
  if (isMobile) {
    await expect(actions.getByRole('link', { name: 'Start focus' })).toBeVisible()
    await expect(actions.getByRole('link', { name: 'Review cards' })).toBeVisible()
  } else await expect(actions).toBeHidden()
  const border = await page.getByRole('list', { name: 'Study stats' }).evaluate(el => getComputedStyle(el).borderTopWidth)
  expect(border).toBe('0px')
})

test('Home on a wide screen does not repeat the sidebar: no shortcut tiles and no course list', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone keeps them')
  await signUp(page)
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Quick actions' })).toBeHidden()
  await expect(page.getByRole('list', { name: 'Your courses' })).toBeHidden()
})
