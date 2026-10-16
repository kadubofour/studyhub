import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUp } from './helpers'

const openCalendar = async (page: Page) => {
  await page.goto('/planner')
  await page.getByRole('tab', { name: 'Week' }).click()
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
  await page.waitForLoadState('networkidle') // let the grid settle (it scrolls to the current time as it appears)
}

test('Week: add an exam, see it in the week and the month, and it is still there after a reload', async ({ page }) => {
  await signUp(page)
  await openCalendar(page)
  await expect(page.getByText('Nothing planned yet')).toBeVisible()
  await page.getByRole('button', { name: 'Add an exam' }).click()
  await page.getByRole('radiogroup', { name: 'Course' }).getByRole('radio', { name: 'Biology' }).click() // an exam is for a course; the day is the one the calendar was on
  await page.getByLabel('Title').fill('Finals')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Nothing planned yet')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Finals/ })).toBeVisible()

  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.getByRole('button', { name: /Finals/ })).toBeVisible()

  await page.reload()
  await page.getByRole('tab', { name: 'Week' }).click()
  await expect(page.getByRole('button', { name: /Finals/ })).toBeVisible()
})

test('Week: add a class (from an empty hour on a computer), and click the class to delete it', async ({ page, isMobile }) => {
  await signUp(page)
  await openCalendar(page)
  if (isMobile) await page.getByRole('button', { name: 'Add a class' }).click()
  else await page.getByTestId('slot-14').first().click()
  await expect(page.getByRole('heading', { name: 'Add class' })).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const block = page.getByRole('button', { name: /^Biology \d/ })
  await expect(block).toBeVisible()
  // a class still being saved cannot be opened yet, so the click is repeated until it opens
  await expect(async () => {
    await block.click()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Biology \d/ })).toHaveCount(0)
})

test('Week: moving around, and the Day view', async ({ page }) => {
  await signUp(page)
  await openCalendar(page)
  const title = page.getByRole('heading', { level: 2 }).filter({ hasText: /\d{4}$/ }).first()
  const first = await title.textContent()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  expect(await title.textContent()).not.toBe(first)
  await page.getByRole('button', { name: 'Today' }).click()
  expect(await title.textContent()).toBe(first)
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await expect(page.getByRole('group', { name: /\d+ \w+$/ })).toHaveCount(1)
})

test('Tasks: a ! makes it high priority, a task can be edited, finished into Done and brought back', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Essay fri !')
  await expect(page.getByText('High priority').first()).toBeVisible()
  await page.getByRole('button', { name: /^Add$/ }).click()
  await expect(page.getByRole('button', { name: 'Edit Essay' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit Essay' }).click()
  await page.getByLabel('Title').fill('Essay draft')
  await page.getByRole('dialog').getByRole('radio', { name: 'Biology' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Essay draft' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit Essay draft' })).toBeVisible() // saved, not just shown

  await page.getByLabel('Mark Essay draft done').click()
  await expect(page.getByRole('button', { name: 'Edit Essay draft' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Done 1/ }).click()
  await page.getByLabel('Mark Essay draft done').click()
  await page.getByRole('button', { name: /^All tasks/ }).click()
  await expect(page.getByRole('button', { name: 'Edit Essay draft' })).toBeVisible()
})

test('Tasks: the type chips filter the list', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Call mum')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.getByLabel('Add a task').fill('Midterm')
  await page.getByRole('radio', { name: 'Exam' }).click()
  await page.getByRole('button', { name: /^Add$/ }).click()
  const chips = page.getByRole('group', { name: 'Task type' })
  await chips.getByRole('button', { name: /^Exams/ }).click()
  await expect(page.getByRole('button', { name: 'Edit Midterm' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Call mum' })).toHaveCount(0)
})

test('Sidebar Upload and Scan are solid and darker, with no dashed outline', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sidebar is for computers')
  await signUp(page)
  const side = page.locator('.app-sidebar')
  for (const name of ['Upload', 'Scan']) {
    const b = side.getByRole('button', { name })
    const style = await b.evaluate(el => { const s = getComputedStyle(el); return { border: s.borderTopStyle, bg: s.backgroundColor } })
    expect(style.border).not.toBe('dashed')
    expect(style.bg).not.toBe('rgba(0, 0, 0, 0)') // filled
  }
})

for (const scheme of ['light', 'dark'] as const) {
  test(`the planner tabs have no serious accessibility problems (${scheme})`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ colorScheme: scheme })
    await signUp(page)
    await page.goto('/planner')
    await page.getByLabel('Add a task').fill('Essay fri !')
    await page.getByRole('button', { name: /^Add$/ }).click()
    await page.waitForLoadState('networkidle')
    const found: string[] = []
    const check = async (label: string) => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      for (const v of r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical')) found.push(`${label}: ${v.id} ${v.nodes[0].target.join(' ')}`)
    }
    await check('tasks')
    await page.getByRole('tab', { name: 'Week' }).click()
    await check('week')
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await check('month')
    const fab = page.getByRole('button', { name: 'Add to calendar' }) // on a phone the Add buttons are behind a round button
    if (await fab.isVisible()) { await fab.click(); await page.getByRole('menuitem', { name: 'Add exam' }).click() } else await page.getByRole('button', { name: 'Add exam' }).click()
    await check('exam dialog')
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Timetable' }).click()
    await check('timetable')
    expect(found).toEqual([])
  })
}
