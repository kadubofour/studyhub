import type { NextConfig } from "next";

// The upgrade UI shows only when the server can actually take payments, so the two never disagree
const billingConfigured = !!process.env.PAYSTACK_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY

const nextConfig: NextConfig = {
  // Baked into the browser bundle at build time; only says yes/no, never a key
  env: { NEXT_PUBLIC_BILLING_ENABLED: billingConfigured ? '1' : '' },
  // Safe headers for every page. Recording and scanning need the microphone and camera, for this site only.
  // (No Content-Security-Policy yet: it needs a careful pass over every script, font and image source.)
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'microphone=(self), camera=(self), geolocation=()' },
      ],
    }]
  },
};

export default nextConfig;
