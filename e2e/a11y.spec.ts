import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUp } from './helpers'

// Serious and critical findings from axe (contrast, missing names, bad structure) on the pages students use most
async function problems(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return r.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${label}: ${v.id} (${v.impact}) ${v.nodes.length}x, e.g. ${v.nodes[0].target.join(' ')} :: ${v.nodes[0].failureSummary?.split('\n')[1]?.trim() ?? ''}`)
}
const settle = async (page: Page) => { await page.waitForLoadState('networkidle') }
// The address of the student's first course page, found from Progress
async function coursePath(page: Page) {
  await page.goto('/progress'); await settle(page)
  return (await page.getByRole('link', { name: 'Open course page' }).getAttribute('href'))!
}

const PUBLIC = ['/', '/login', '/signup', '/terms', '/privacy']
const APP = ['/home', '/planner', '/flashcards', '/notes', '/progress', '/settings', '/tutor', '/lectures', '/library', '/profile']

for (const scheme of ['light', 'dark'] as const) {
  test(`public pages have no serious accessibility problems (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    const found: string[] = []
    for (const path of PUBLIC) { await page.goto(path); await settle(page); found.push(...await problems(page, `${scheme} ${path}`)) }
    expect(found).toEqual([])
  })

  test(`the app pages have no serious accessibility problems (${scheme}, Classic)`, async ({ page }) => {
    test.setTimeout(150_000)
    await page.emulateMedia({ colorScheme: scheme })
    await signUp(page)
    await page.goto('/settings')
    await page.getByRole('radio', { name: 'Classic look' }).click() // new students start on Vivid
    await expect(page.locator('.app-root')).toHaveAttribute('data-look', 'classic')
    const found: string[] = []
    for (const path of [...APP, await coursePath(page)]) { await page.goto(path); await settle(page); found.push(...await problems(page, `${scheme} classic ${path}`)) }
    expect(found).toEqual([])
  })

  for (const look of ['Paper', 'Vivid', 'Playful'] as const) {
    test(`the app pages have no serious accessibility problems (${scheme}, ${look})`, async ({ page }) => {
      test.setTimeout(150_000)
      await page.emulateMedia({ colorScheme: scheme })
      await signUp(page)
      await page.goto('/settings')
      await page.getByRole('radio', { name: `${look} look` }).click()
      await expect(page.locator('.app-root')).toHaveAttribute('data-look', look.toLowerCase())
      const found: string[] = []
      for (const path of ['/home', '/planner', '/flashcards', '/notes', '/progress', '/settings', '/library', '/profile', await coursePath(page)]) { await page.goto(path); await settle(page); found.push(...await problems(page, `${scheme} ${look} ${path}`)) }
      expect(found).toEqual([])
    })
  }
}

test('the Upload and Delete-account dialogs have no serious accessibility problems', async ({ page }) => {
  test.setTimeout(90_000)
  await signUp(page)
  await page.goto('/notes')
  await settle(page)
  await page.getByRole('button', { name: 'Upload' }).first().click()
  await expect(page.getByRole('heading', { name: 'Upload material' })).toBeVisible()
  const found = await problems(page, 'upload dialog')
  await page.keyboard.press('Escape')
  await page.goto('/settings')
  await settle(page)
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByRole('heading', { name: 'Delete your account?' })).toBeVisible()
  found.push(...await problems(page, 'delete dialog'))
  expect(found).toEqual([])
})
