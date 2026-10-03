// E2E ONLY: a stand-in for OpenAI's Responses API, so browser tests never call the real API.
// Active only when E2E_FAKE_AI=1 outside production (the E2E dev server sets it).
const enabled = () => process.env.E2E_FAKE_AI === '1' && process.env.NODE_ENV !== 'production'

const CANNED: Record<string, unknown> = {
  summary: { summary_md: 'The Krebs cycle makes **NADH** in the mitochondrial matrix.' },
  flashcards: { cards: [{ front: 'Where is the Krebs cycle?', back: 'Mitochondrial matrix' }, { front: 'What does it make?', back: 'NADH' }] },
  quiz: { title: 'Krebs cycle quiz', questions: [
    { type: 'mcq', prompt: 'Where does the Krebs cycle happen?', options: ['Cytoplasm', 'Mitochondrial matrix', 'Nucleus', 'Ribosome'], answer: 'Mitochondrial matrix', explanation: 'Its enzymes are in the matrix.' },
    { type: 'true_false', prompt: 'The Krebs cycle makes glucose.', options: null, answer: 'false', explanation: 'It breaks down acetyl-CoA.' },
    { type: 'short', prompt: 'Name the main electron carrier it produces.', options: null, answer: 'NADH', explanation: 'NADH carries electrons to the chain.' },
    { type: 'short', prompt: 'What molecule enters the cycle?', options: null, answer: 'Acetyl-CoA', explanation: 'Acetyl-CoA joins oxaloacetate.' },
  ] },
  mark: { correct: true, feedback: 'Yes, that means acetyl-CoA.' },
}

export async function POST(request: Request) {
  if (!enabled()) return new Response('Not found', { status: 404 })
  const body = await request.json().catch(() => ({})) as { model?: string; text?: { format?: { name?: string } } }
  // A PDF named "…fallback…" is refused, so E2E can check the plain-text fallback
  if (JSON.stringify(body).includes('fallback')) {
    return Response.json({ error: { message: 'Fake: this file cannot be read.', type: 'invalid_request_error' } }, { status: 400 })
  }
  const name = body.text?.format?.name
  const text = name ? JSON.stringify(CANNED[name] ?? {}) : '# Fake note\n\nConverted by the fake AI.'
  return Response.json({
    id: 'resp_fake', object: 'response', created_at: Math.floor(Date.now() / 1000), status: 'completed',
    model: body.model ?? 'fake', incomplete_details: null, error: null,
    output: [{ id: 'msg_fake', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
  })
}
