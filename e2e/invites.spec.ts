import { test, expect, type Browser, type Page, type TestInfo } from '@playwright/test'
import { signUp } from './helpers'

async function second(browser: Browser, info: TestInfo): Promise<Page> {
  const u = info.project.use
  const ctx = await browser.newContext({ baseURL: u.baseURL, viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor })
  return ctx.newPage()
}
async function myCode(page: Page) {
  await page.goto('/leaderboard')
  await page.waitForLoadState('networkidle')
  return (await page.locator('[aria-labelledby="my-code"]').textContent())!.trim()
}

test.describe('invite links', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'two browsers at once: desktop only') })

  test('opening a friend link while signed out asks to sign in, then comes back to send the request', async ({ page, browser }, info) => {
    test.setTimeout(150_000)
    await signUp(page)
    const code = await myCode(page)

    const visitor = await second(browser, info)
    await visitor.goto(`/add/${code}`)
    await expect(visitor).toHaveURL(/\/login\?next=%2Fadd%2F/)
    await visitor.getByRole('link', { name: 'Create account' }).click()
    await expect(visitor).toHaveURL(/\/signup\?next=/)
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
    await visitor.getByLabel('Name').fill('Kofi')
    await visitor.getByLabel('Email', { exact: true }).fill(email)
    await visitor.getByLabel('Confirm email').fill(email)
    await visitor.getByLabel('Password', { exact: true }).fill('local-e2e-pass-123')
    await visitor.getByRole('button', { name: 'Create account' }).click()
    await expect(visitor).toHaveURL(/\/onboarding/)
    await visitor.getByLabel('Your first course').fill('Biology')
    await visitor.getByRole('button', { name: 'Continue' }).click()
    await expect(visitor).toHaveURL(new RegExp(`/add/${code}$`))

    await expect(visitor.getByText('Ama')).toBeVisible()
    await visitor.getByRole('button', { name: 'Send friend request' }).click()
    await expect(visitor.getByText(/Request sent/)).toBeVisible()
    await visitor.getByRole('link', { name: 'Open the leaderboard' }).click()
    await expect(visitor).toHaveURL(/\/leaderboard/)

    await page.goto('/leaderboard')
    await expect(page.getByRole('region', { name: 'Friend requests' }).getByRole('listitem')).toHaveCount(1)
    await visitor.close()
  })

  test('your own code and a code that does not work say so', async ({ page }) => {
    test.setTimeout(90_000)
    await signUp(page)
    const code = await myCode(page)
    await page.goto(`/add/${code}`)
    await expect(page.getByText("That's your own code")).toBeVisible()
    await page.goto('/add/ZZZZZZZZ')
    await expect(page.getByRole('heading', { name: "This friend link doesn't work any more" })).toBeVisible()
    await page.goto('/join/not-a-real-token')
    await expect(page.getByRole('heading', { name: "This invite doesn't work any more" })).toBeVisible()
  })

  test('a group invite link shows the group, then Join group opens its board', async ({ page, browser }, info) => {
    test.setTimeout(150_000)
    await signUp(page)
    await page.goto('/leaderboard')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'New group' }).click()
    await page.getByLabel('Name').fill('Bio crew')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    const token = (await page.getByLabel('Invite code').textContent())!.trim()

    const other = await second(browser, info)
    await signUp(other)
    await other.goto(`/join/${token}`)
    await expect(other.getByRole('heading', { name: 'Bio crew' })).toBeVisible()
    await expect(other.getByText('1 member')).toBeVisible()
    await other.getByRole('button', { name: 'Join group' }).click()
    await expect(other).toHaveURL(/\/leaderboard\?group=/)
    await expect(other.getByRole('button', { name: 'Bio crew', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await other.close()
  })

  test('your own link costs no lookups, and a busy lookup says so instead of calling the link dead', async ({ page }) => {
    test.setTimeout(180_000)
    await signUp(page)
    const code = await myCode(page)
    for (let i = 0; i < 31; i++) await page.goto(`/add/${code}`)
    await expect(page.getByText("That's your own code")).toBeVisible()
    await page.goto('/add/ZZZZZZZZ')
    await expect(page.getByRole('heading', { name: "This friend link doesn't work any more" })).toBeVisible()
    await page.goto('/add/%25zz')
    await expect(page.getByRole('heading', { name: "This friend link doesn't work any more" })).toBeVisible()
    for (let i = 0; i < 30; i++) await page.goto('/add/ZZZZZZZZ')
    await expect(page.getByText("Couldn't look this up right now. Try again in a while.")).toBeVisible()
  })
})
