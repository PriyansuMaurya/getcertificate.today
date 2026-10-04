// Only same-origin relative paths may be used as post-auth redirect targets.
// Rejects protocol-relative (//evil.com), backslash tricks, and absolute URLs
// so a crafted ?next= can never bounce a signed-in user off-site.
//
// Deliberately NOT exported from a 'use server' module: every export there
// becomes a publicly callable endpoint. This is a plain helper shared by the
// auth route handlers.
export function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (raw.length > 512) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}
