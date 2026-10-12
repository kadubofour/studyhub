import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUp } from './helpers'

const openCalendar = async (page: Page) => {
  await page.goto('/planner')
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
}

test('Calendar: add an exam, see it in the week and the month, and it is still there after a reload', async ({ page }) => {
  await signUp(page)
  await openCalendar(page)
  await expect(page.getByText('Add your first exam')).toBeVisible()
  await page.getByRole('button', { name: 'Add an exam' }).click()
  await page.getByLabel('Title').fill('Finals')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Add your first exam')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Finals/ })).toBeVisible()

  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.getByRole('button', { name: /Finals/ })).toBeVisible()

  await page.reload()
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.getByRole('button', { name: /Finals/ })).toBeVisible()
})

test('Calendar: click an empty hour to add a class there, and click the class to delete it', async ({ page }) => {
  await signUp(page)
  await openCalendar(page)
  await page.getByTestId('slot-10').first().click()
  await expect(page.getByRole('heading', { name: 'Add class' })).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const block = page.getByRole('button', { name: /^Biology \d/ })
  await expect(block).toBeVisible()
  await block.click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Biology \d/ })).toHaveCount(0)
})

test('Calendar: moving around and the mini month', async ({ page, isMobile }) => {
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
  if (!isMobile) await expect(page.getByRole('complementary', { name: 'Month' })).toBeVisible()
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
  await page.getByRole('dialog').getByLabel('Course').selectOption({ label: 'Biology' })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Essay draft' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit Essay draft' })).toBeVisible() // saved, not just shown

  await page.getByLabel('Mark Essay draft done').click()
  await expect(page.getByRole('button', { name: 'Edit Essay draft' })).toHaveCount(0)
  await page.getByRole('button', { name: /Done \(1\)/ }).click()
  await page.getByRole('region', { name: 'Done' }).getByLabel('Mark Essay draft done').click()
  await expect(page.getByRole('button', { name: 'Edit Essay draft' })).toBeVisible()
})

test('Tasks: the type chips filter the list', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Call mum')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.getByLabel('Add a task').fill('Midterm')
  await page.getByLabel('Type', { exact: true }).selectOption('exam')
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
  test(`the calendar and task list have no serious accessibility problems (${scheme})`, async ({ page }) => {
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
    await page.getByRole('tab', { name: 'Calendar' }).click()
    await check('calendar week')
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await check('calendar month')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('menuitem', { name: 'Exam date' }).click()
    await check('exam dialog')
    expect(found).toEqual([])
  })
}
