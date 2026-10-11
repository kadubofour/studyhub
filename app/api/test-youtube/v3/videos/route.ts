// E2E ONLY: stand-in for the YouTube Data API video details. See ../search/route.ts.
const enabled = () => process.env.E2E_FAKE_AI === '1' && process.env.NODE_ENV !== 'production'

export async function GET() {
  if (!enabled()) return new Response('Not found', { status: 404 })
  return Response.json({ items: [
    { id: 'fakekrebs01', snippet: { title: 'Krebs cycle: full explanation', channelTitle: 'Bio Explained' }, contentDetails: { duration: 'PT12M5S' }, statistics: { viewCount: '120000' } },
    { id: 'fakekrebs02', snippet: { title: 'Krebs cycle in 60 seconds', channelTitle: 'Quick Bio' }, contentDetails: { duration: 'PT1M' }, statistics: { viewCount: '900000' } }, // too short: left out
  ] })
}
