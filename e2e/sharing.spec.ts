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

test('the Share dialog opens from a deck, shows the link and does not scroll sideways', async ({ page }) => {
  await signUp(page)
  await page.goto('/flashcards')
  await page.getByRole('button', { name: 'Create a deck' }).click()
  await page.getByLabel('Name').fill('Cells')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText('Cells').click()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Share Cells' })
  await expect(dialog.getByRole('textbox', { name: 'Link' })).toHaveValue(/\/s\/.+/)
  await dialog.getByRole('button', { name: 'New link' }).click()
  await expect(dialog.getByRole('status')).toHaveText('New link made. The old one no longer works.')
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(wide).toBe(false)
  const box = await dialog.boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('Share my progress draws the card as a 1080×1350 picture in the look\'s colours, and its link shows the card', async ({ page }) => {
  await signUp(page)
  await page.goto('/progress')
  await page.getByRole('button', { name: 'Share my progress' }).click()
  const dialog = page.getByRole('dialog', { name: 'Share my progress' })
  await expect(dialog.getByRole('img', { name: /^Ama's progress on Studyhub: level 1/ })).toBeVisible()
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download picture' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('studyhub-progress.png')
  const bytes = await (await import('node:fs/promises')).readFile(await file.path())
  // the PNG header: 1080 wide, 1350 tall
  expect(bytes.subarray(1, 4).toString()).toBe('PNG')
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1350])
  // its background is the look's raised colour, written in (a CSS variable would have drawn nothing)
  const [drawn, raised] = await page.evaluate(async b64 => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0)
    const [r, g, b, a] = ctx.getImageData(10, 10, 1, 1).data
    const probe = document.createElement('span'); probe.style.color = 'var(--raised)'
    document.querySelector('.app-root[data-look]')!.append(probe)
    const want = getComputedStyle(probe).color; probe.remove()
    return [`rgb(${r}, ${g}, ${b})${a === 255 ? '' : ' alpha'}`, want]
  }, bytes.toString('base64'))
  expect(drawn).toBe(raised)

  const link = await dialog.getByRole('textbox', { name: 'Link' }).inputValue()
  await page.goto(link)
  await expect(page.getByRole('img', { name: /^Ama's progress on Studyhub: level 1/ })).toBeVisible()
})
