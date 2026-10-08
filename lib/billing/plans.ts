// Plan limits and prices. The limits are also enforced in SQL (supabase/migrations/…_billing.sql);
// tests/unit/billingPlans.test.ts keeps the two in step.
export const FREE_DAILY_ACTIONS = 10
export const FREE_DAILY_TUTOR_MESSAGES = 20
export const FAIR_USE_MONTHLY_ACTIONS = 400
export const FAIR_USE_TRANSCRIPT_HOURS = 20
export const SPEED_LIMIT_PER_MINUTE = 10

export type ProductId = 'pass_1m' | 'pass_3m' | 'pass_12m' | 'renew_1m' | 'renew_12m'
export const PRODUCTS: Record<ProductId, { months: number; amountMinor: number; label: string }> = {
  pass_1m: { months: 1, amountMinor: 5000, label: '1 month' },
  pass_3m: { months: 3, amountMinor: 13500, label: '3 months' },
  pass_12m: { months: 12, amountMinor: 48000, label: '1 year' },
  renew_1m: { months: 1, amountMinor: 5000, label: '1 month (renewal)' },
  renew_12m: { months: 12, amountMinor: 48000, label: '1 year (renewal)' },
}

export type CheckoutChoice = '1m' | '3m' | '12m'
export const CHOICES: Record<CheckoutChoice, { pass: ProductId; renew: ProductId | null; save: string | null }> = {
  '1m': { pass: 'pass_1m', renew: 'renew_1m', save: null },
  '3m': { pass: 'pass_3m', renew: null, save: 'save 10%' },
  '12m': { pass: 'pass_12m', renew: 'renew_12m', save: 'save 20%' },
}

export function formatGhs(minor: number): string {
  const cedis = minor / 100
  return `GHS ${Number.isInteger(cedis) ? cedis : cedis.toFixed(2)}`
}

// AI actions a PDF costs: 1 per 10 pages, rounded up (an unreadable page count counts as 1)
export const pdfActionCost = (pages: number) => Math.min(10, Math.max(1, Math.ceil(pages / 10)))
