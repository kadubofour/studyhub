// E2E ONLY: a stand-in for the YouTube Data API search, so browser tests never call Google.
// Active only when E2E_FAKE_AI=1 outside production (the E2E dev server sets it).
const enabled = () => process.env.E2E_FAKE_AI === '1' && process.env.NODE_ENV !== 'production'

export async function GET() {
  if (!enabled()) return new Response('Not found', { status: 404 })
  return Response.json({ items: [
    { id: { kind: 'youtube#video', videoId: 'fakekrebs01' }, snippet: { title: 'Krebs cycle: full explanation', channelTitle: 'Bio Explained', liveBroadcastContent: 'none' } },
    { id: { kind: 'youtube#video', videoId: 'fakekrebs02' }, snippet: { title: 'Krebs cycle in 60 seconds', channelTitle: 'Quick Bio', liveBroadcastContent: 'none' } },
  ] })
}
