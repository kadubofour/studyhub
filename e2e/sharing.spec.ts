import { test, expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test'
import path from 'node:path'
import { rpcAs, signUp } from './helpers'

const CELL = path.join(__dirname, 'fixtures', 'cell.png')

async function second(browser: Browser, info: TestInfo): Promise<Page> {
  const u = info.project.use
  const ctx = await browser.newContext({ baseURL: u.baseURL, viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor })
  return ctx.newPage()
}
// The picture has really been drawn, not just its description
const drawn = async (img: Locator) => {
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
}

test('a signed-out visitor opens a shared note, signs up, copies it, and the copy opens with its picture', async ({ page, browser }, info) => {
  test.setTimeout(180_000)
  const email = await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  const original = page.url().split('/').pop()!
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Title').fill('Cell notes')
  await page.getByLabel('Choose pictures').setInputFiles(CELL)
  await expect(page.locator('.ProseMirror img[alt="cell"]')).toBeVisible()
  await expect(page.getByText('Saved')).toBeVisible()
  const token = await rpcAs<string>(email, 'share_item', { p_kind: 'note', p_item: original })

  const visitor = await second(browser, info)
  await visitor.goto(`/s/${token}`)
  await expect(visitor.getByText('Shared by')).toBeVisible()
  await expect(visitor.getByText('Ama', { exact: true })).toBeVisible()
  await expect(visitor.getByRole('heading', { name: 'Cell notes' })).toBeVisible()
  const shown = visitor.getByRole('article').locator('img[alt="cell"]')
  await expect(shown).toHaveAttribute('src', new RegExp(`^/s/${token}/image/[0-9a-f-]{36}\\.webp$`))
  await drawn(shown)
  // the page is not for search engines
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)

  await visitor.getByRole('link', { name: 'Copy to my Studyhub' }).click()
  await expect(visitor).toHaveURL(/\/login\?next=%2Fs%2F/)
  await visitor.getByRole('link', { name: 'Create account' }).click()
  await expect(visitor).toHaveURL(/\/signup\?next=/)
  const other = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  await visitor.getByLabel('Name').fill('Kofi')
  await visitor.getByLabel('Email', { exact: true }).fill(other)
  await visitor.getByLabel('Confirm email').fill(other)
  await visitor.getByLabel('Password', { exact: true }).fill('local-e2e-pass-123')
  await visitor.getByRole('button', { name: 'Create account' }).click()
  await expect(visitor).toHaveURL(/\/onboarding/)
  await visitor.getByLabel('Your first course').fill('Biology')
  await visitor.getByRole('button', { name: 'Continue' }).click()
  await expect(visitor).toHaveURL(new RegExp(`/s/${token}\\?copy=1$`))

  // back from signing up it offers the copy, and waits to be asked
  await expect(visitor.getByText(/You're signed in/)).toBeVisible()
  await visitor.getByRole('button', { name: 'Copy to my Studyhub' }).click()
  await expect(visitor).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  expect(visitor.url()).not.toContain(original)
  await expect(visitor.getByLabel('Title')).toHaveValue('Cell notes')
  await drawn(visitor.locator('.ProseMirror img[alt="cell"]'))

  // the owner turns the link off: the page says so
  await rpcAs(email, 'unshare_item', { p_kind: 'note', p_item: original })
  await visitor.goto(`/s/${token}`)
  await expect(visitor.getByRole('heading', { name: 'This link was turned off' })).toBeVisible()
  await visitor.context().close()
})
