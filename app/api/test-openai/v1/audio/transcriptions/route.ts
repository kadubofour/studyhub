// E2E ONLY: a stand-in for OpenAI's transcription API (whisper-1, verbose_json). Every part
// "says" the same two lines, 3 seconds long.
const enabled = () => process.env.E2E_FAKE_AI === '1' && process.env.NODE_ENV !== 'production'

export async function POST() {
  if (!enabled()) return new Response('Not found', { status: 404 })
  const segment = (id: number, start: number, end: number, text: string) =>
    ({ id, seek: 0, start, end, text, tokens: [], temperature: 0, avg_logprob: 0, compression_ratio: 1, no_speech_prob: 0 })
  return Response.json({
    task: 'transcribe', language: 'english', duration: 3, text: 'Welcome to the lecture. Today we look at cells.',
    segments: [segment(0, 0, 1.5, ' Welcome to the lecture.'), segment(1, 1.5, 3, ' Today we look at cells.')],
  })
}
