import { NextResponse } from 'next/server'
import type { NextMiddleware, NextRequest } from 'next/server'

// Configure which paths should have security headers
// All paths except API routes, internal endpoints, and static assets
const protectedPaths = ['/((?!_next|api|auth|\\.(png|jpg|jpeg|svg|ico|js|css|webp|apm|webmanifest|txt|rss|atom|mp3|mp4|mov|wav|pdf|doc|docx|xls|xlsx|zip|gz|tar))).*']

// Security headers configuration
const securityHeaders = [
  // Content Security Policy - restrict sources for various content types
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';",
  },
  // HTTP Strict Transport Security - enforce HTTPS for 1 year
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // Prevent MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Prevent XSS attacks via header
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Referrer policy - limit referrer information
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Cache control - prevent sensitive pages from being cached
  {
    key: 'Cache-Control',
    value: 'no-store, max-age=0',
  },
]

// Apply headers to all matching paths
export const middleware: NextMiddleware = async (request) => {
  const response = NextResponse.next()

  // Apply all security headers
  securityHeaders.forEach(({ key, value }) => {
    response.headers.set(key, value)
  })

  return response
}

// Configure which routes the middleware runs on
// Run on all paths except API routes, auth, and static assets
export const config = {
  matcher: protectedPaths,
}