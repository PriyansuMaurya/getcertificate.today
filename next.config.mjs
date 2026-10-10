import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the Turbopack workspace root to this project. Without this, Turbopack
  // walks up into C:\Users\priya, finds a package-lock.json outside this git
  // repository, and warns that it had to ignore it.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  // Baseline security headers applied to every response.
  //
  // The CSP here is deliberately the *safe subset* - frame-ancestors,
  // object-src, base-uri and form-action - each of which has no effect on
  // resource loading, so it cannot break analytics, the Google sign-in iframe,
  // the YouTube IFrame API, or Stripe's redirect checkout. A stricter
  // script/style CSP would need per-request nonces and thorough testing across
  // those third parties before it could be switched on.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          // Only meaningful over HTTPS (ignored over http, e.g. localhost), so
          // it is safe to send unconditionally.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
