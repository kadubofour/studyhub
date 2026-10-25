import { test, expect, type Browser, type Page, type TestInfo } from '@playwright/test'
import { signUp } from './helpers'

// Two students side by side: the test's own page and a second browser with its own sign-in
async function second(browser: Browser, info: TestInfo): Promise<Page> {
  const u = info.project.use
  const ctx = await browser.newContext({ baseURL: u.baseURL, viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor })
  return ctx.newPage()
}
const rowsOf = (page: Page, board = 'Friends board') => page.getByRole('list', { name: board }).getByRole('listitem')
async function openBoard(page: Page) {
  await page.goto('/leaderboard')
  await page.waitForLoadState('networkidle')
}

test.describe('two students', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'two browsers at once: desktop only') })

  test('friend by code: request, accept, both see each other on the board', async ({ page, browser }, info) => {
    test.setTimeout(150_000)
    const other = await second(browser, info)
    await signUp(page)
    await signUp(other)

    await openBoard(page)
    await expect(page.getByRole('heading', { name: 'Add your first friend' })).toBeVisible()
    const code = (await page.locator('[aria-labelledby="my-code"]').textContent())!.trim()
    expect(code).toMatch(/^[A-Z0-9]{8}$/)

    await openBoard(other)
    await other.getByLabel('A friend\'s code').fill(code)
    await other.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(other.getByText(/Request sent/)).toBeVisible()

    await openBoard(page)
    const requests = page.getByRole('region', { name: 'Friend requests' })
    await requests.getByRole('button', { name: /^Accept / }).click()
    await expect(page.getByText(/are friends now/)).toBeVisible()
    await expect(rowsOf(page)).toHaveCount(2)
    await expect(rowsOf(page).filter({ hasText: 'You' })).toHaveCount(1)

    await openBoard(other)
    await expect(rowsOf(other)).toHaveCount(2)
    await expect(other.getByRole('region', { name: 'Your friends' }).getByRole('listitem')).toHaveCount(1)
    await other.close()
  })

  test('Add in person: one shows a code, the other enters it, both become friends at once', async ({ page, browser }, info) => {
    test.setTimeout(150_000)
    const other = await second(browser, info)
    await signUp(page)
    await signUp(other)

    await openBoard(page)
    await page.getByRole('button', { name: 'Add in person' }).click()
    const shown = page.getByLabel('Your in-person code')
    await expect(shown).toHaveText(/^\d{6}$/)
    const code = (await shown.textContent())!.trim()
    await expect(page.getByText(/Works for \d:\d\d/)).toBeVisible()

    await openBoard(other)
    await other.getByRole('button', { name: 'Add in person' }).click()
    await other.getByRole('radio', { name: 'Enter a code' }).click()
    await other.getByLabel('Their 6-digit code').fill(code)
    await other.getByRole('button', { name: 'Add friend' }).click()
    await expect(other.getByText('You are friends now.')).toBeVisible()
    await expect(rowsOf(other)).toHaveCount(2)

    // the one showing the code learns it was used without doing anything
    await expect(page.getByText('You are friends now.')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('Your in-person code')).toHaveCount(0)
    await expect(rowsOf(page)).toHaveCount(2)
    await other.close()
  })

  test('create a group, join by its link, both on the group board', async ({ page, browser }, info) => {
    test.setTimeout(150_000)
    const other = await second(browser, info)
    await signUp(page)
    await signUp(other)

    await openBoard(page)
    await page.getByRole('button', { name: 'New group' }).click()
    await page.getByLabel('Name').fill('Bio crew')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Bio crew', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(rowsOf(page, 'Bio crew board')).toHaveCount(1)
    const token = (await page.getByLabel('Invite code').textContent())!.trim()
    const link = `${info.project.use.baseURL}/join/${token}`

    await openBoard(other)
    await other.getByRole('button', { name: 'Join group' }).click()
    await other.getByLabel('Invite link or code').fill(link)
    await other.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(other.getByRole('button', { name: 'Bio crew', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(rowsOf(other, 'Bio crew board')).toHaveCount(2)
    // a member sees Leave, not the owner's tools
    await expect(other.getByRole('button', { name: 'Leave group' })).toBeVisible()
    await expect(other.getByRole('button', { name: 'Invite link' })).toHaveCount(0)

    await openBoard(page)
    await page.getByRole('button', { name: 'Bio crew', exact: true }).click()
    await expect(rowsOf(page, 'Bio crew board')).toHaveCount(2)
    await expect(page.getByRole('list', { name: 'Members' }).getByRole('listitem')).toHaveCount(2)
    await other.close()
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'mobile', 'phone layout only') })

  test('the Leaderboard page fits a phone with no sideways scroll', async ({ page }) => {
    test.setTimeout(120_000)
    await signUp(page)
    await openBoard(page)
    const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(await sideways()).toBeLessThanOrEqual(0)
    // a group with a long name and its invite
    await page.getByRole('button', { name: 'New group' }).click()
    await page.getByLabel('Name').fill('Second-year biochemistry revision circle')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Second-year biochemistry revision circle board' })).toBeVisible()
    expect(await sideways()).toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Friends', exact: true }).click()
    await page.getByRole('button', { name: 'Add in person' }).click()
    await expect(page.getByLabel('Your in-person code')).toHaveText(/^\d{6}$/)
    expect(await sideways()).toBeLessThanOrEqual(0)
  })
})
