import 'server-only'
import * as paystack from './paystack'

// The payment provider the billing routes talk to, in provider-neutral shapes. Paystack is the
// only implementation; a worldwide provider later adds one implementation (and its webhook route).

export type VerifiedCharge = {
  reference: string; status: 'success' | 'failed' | 'pending'; amountMinor: number; currency: string
  channel: 'mobile_money' | 'card' | 'other'; paidAt: string | null
  userId: string | null; product: string | null; planCode: string | null
  customerCode: string | null; cardBrand: string | null; cardLast4: string | null
}

/** A notification worth acting on; `key` identifies it so it's handled once */
export type BillingEvent =
  | { kind: 'charge'; type: string; key: string; reference: string }
  | { kind: 'subscription'; type: string; key: string; customerCode: string | null; subscriptionCode: string | null; emailToken: string | null; active: boolean }
  | { kind: 'refund'; type: string; key: string; reference: string | null; amountMinor: number | null }

export type CheckoutRequest = {
  email: string; amountMinor: number; callbackUrl: string; channels: ('card' | 'mobile_money')[]
  metadata: { user_id: string; product: string }; planCode?: string
}

export type BillingProvider = {
  name: string
  /** Request header carrying the webhook signature */
  signatureHeader: string
  initializeCheckout(o: CheckoutRequest): Promise<{ url: string; reference: string }>
  verifyTransaction(reference: string): Promise<VerifiedCharge>
  disableSubscription(code: string, token: string): Promise<void>
  verifySignature(rawBody: string, header: string | null): boolean
  /** null for events Studyhub doesn't use */
  parseWebhook(rawBody: string): BillingEvent | null
}

export const billing: BillingProvider = {
  name: 'paystack',
  signatureHeader: 'x-paystack-signature',
  // Looked up on each call, so tests can stand in for any single Paystack function
  initializeCheckout: o => paystack.initializeCheckout(o),
  verifyTransaction: reference => paystack.verifyTransaction(reference),
  disableSubscription: (code, token) => paystack.disableSubscription(code, token),
  verifySignature: (rawBody, header) => paystack.verifySignature(rawBody, header),
  parseWebhook: rawBody => paystack.parseWebhook(rawBody),
}
