import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

// The recordings in public/sounds are real, can be read by the browser, and play without errors
for (const [button, file] of [['Rain', 'rain'], ['Ocean', 'sea'], ['Lo-fi', 'lofi']] as const) {
  test(`${button}: its recording loads and plays as a loop`, async ({ page }) => {
    const problems: string[] = []
    page.on('pageerror', e => problems.push(e.message))
    page.on('console', m => { if (m.type() === 'error') problems.push(m.text()) })
    await signUp(page)
    await page.goto('/focus')
    await page.waitForLoadState('networkidle')
    const loaded = page.waitForResponse(r => (file === 'lofi' ? /\/sounds\/lofi-\d\.ogg$/.test(r.url()) : r.url().endsWith(`/sounds/${file}.ogg`)))
    await page.getByRole('button', { name: button, exact: true }).click()
    const res = await loaded
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('ogg')
    if (file !== 'lofi') expect((await res.body()).length).toBeGreaterThan(100_000)
    await page.waitForTimeout(800)
    await expect(page.getByRole('button', { name: button, exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(problems.filter(p => !/favicon|Download the React DevTools/.test(p))).toEqual([])
  })
}

test('the browser can decode each recording, and each is the length it should be', async ({ page }) => {
  await page.goto('/login')
  const got = await page.evaluate(async () => {
    const ctx = new AudioContext()
    const out: Record<string, { seconds: number; channels: number }> = {}
    for (const f of ['rain', 'sea', 'lofi-1', 'lofi-2', 'lofi-3']) {
      const buf = await ctx.decodeAudioData(await (await fetch(`/sounds/${f}.ogg`)).arrayBuffer())
      out[f] = { seconds: Math.round(buf.duration), channels: buf.numberOfChannels }
    }
    return out
  })
  expect(got.rain.seconds).toBe(240)
  expect(got.sea.seconds).toBe(58)
  expect(got['lofi-1'].seconds).toBe(128)
  expect(got['lofi-2'].seconds).toBe(88)
  expect(got['lofi-3'].seconds).toBe(123)
})

test('Lo-fi really plays a track (the audio element is moving), and stops when turned off', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __els: HTMLMediaElement[] }
    w.__els = []
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { w.__els.push(this); return play.call(this) }
  })
  await signUp(page)
  await page.goto('/focus')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Lo-fi', exact: true }).click()
  await page.waitForTimeout(3500)
  const state = () => page.evaluate(() => (window as unknown as { __els: HTMLMediaElement[] }).__els.map(e => ({ src: e.src.split('/').pop(), paused: e.paused, t: e.currentTime })))
  const going = (await state()).filter(e => !e.paused)
  expect(going).toHaveLength(1)
  expect(going[0].src).toMatch(/^lofi-\d\.ogg$/)
  expect(going[0].t).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Off', exact: true }).click()
  await page.waitForTimeout(1200)
  expect((await state()).every(e => e.paused)).toBe(true)
})
