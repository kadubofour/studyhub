// E2E ONLY: transactions the fake Paystack has seen (one dev server process)
export type FakeTx = {
  reference: string; email: string; amount: number; currency: string; callback_url: string
  metadata: Record<string, unknown>; plan: string | null; status: 'ongoing' | 'success' | 'failed'; channel: string
}
const g = globalThis as unknown as { __fakePaystack?: Map<string, FakeTx> }
export const fakeTxs = (g.__fakePaystack ??= new Map())
