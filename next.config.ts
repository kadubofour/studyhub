import type { NextConfig } from "next";

// The upgrade UI shows only when the server can actually take payments, so the two never disagree
const billingConfigured = !!process.env.PAYSTACK_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY

const nextConfig: NextConfig = {
  // pdf.js counts PDF pages on the server (lib/import/pdfPages.ts); it loads its own worker
  // module at runtime, so it runs from node_modules instead of being bundled
  serverExternalPackages: ['pdfjs-dist'],
  // Baked into the browser bundle at build time; only says yes/no, never a key
  env: { NEXT_PUBLIC_BILLING_ENABLED: billingConfigured ? '1' : '' },
};

export default nextConfig;
