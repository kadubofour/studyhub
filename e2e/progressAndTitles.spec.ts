import { test, expect } from '@playwright/test'
import { noteWithText, signUp, openLibraryMaterials } from './helpers'

test('Progress welcomes a new student in words, not a row of zeros, and the tab names the page', async ({ page }) => {
  await signUp(page)
  await page.goto('/progress')
  await expect(page).toHaveTitle('Progress · Studyhub')
  const top = page.getByRole('region', { name: 'Your progress' })
  await expect(top.getByRole('heading', { level: 2, name: 'Your first session starts it all.' })).toBeVisible()
  await expect(top.getByRole('link', { name: 'Start focus' })).toHaveAttribute('href', '/focus')
  await expect(top.getByRole('list', { name: 'This week' }).getByRole('listitem')).toHaveCount(7)
  const stats = page.getByRole('list', { name: 'Study stats' })
  await expect(stats.getByText('Study today to start one')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Focus by week' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Cards reviewed by day' })).toBeVisible()
  // the streak here is the one in the top bar and on the Profile, so they cannot disagree
  await expect(stats.getByText('0 days')).toBeVisible()
})

test('every page names itself in the tab: Courses, Practice, Tutor, Planner, Profile', async ({ page }) => {
  await signUp(page)
  for (const [path, title] of [['/courses', 'Courses'], ['/flashcards', 'Practice'], ['/quiz', 'Practice'], ['/tutor', 'Tutor'], ['/planner', 'Planner'], ['/profile', 'Profile'], ['/home', 'Home']] as const) {
    await page.goto(path)
    await expect(page, path).toHaveTitle(`${title} · Studyhub`)
  }
})

test('the Library shows a note\'s words and offers study actions from its menu', async ({ page, isMobile }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await openLibraryMaterials(page)
  const row = page.getByRole('link', { name: /Krebs cycle/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText('The Krebs cycle happens in the mitochondrial matrix') // what is inside, as plain words
  if (isMobile) return // a phone opens the menu by a long press, which a tap cannot do
  await page.getByRole('button', { name: 'More actions for Krebs cycle' }).click()
  const menu = page.getByRole('menu')
  for (const name of ['Open', 'Ask the tutor', 'Make flashcards', 'Quiz me', 'Summarise']) await expect(menu.getByRole('menuitem', { name })).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Make flashcards' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/)
})
