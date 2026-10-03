import { appendFileSync } from 'node:fs';
import path from 'node:path';

// Temporary diagnostic sink: the dev server console isn't reachable from the
// app, and every auth-code-error redirect currently swallows its cause.
// Writes one JSON line per event to .auth-debug.log (gitignored).
export function logAuth(event: string, data: Record<string, unknown> = {}) {
  // Dev-only: never write auth diagnostics (emails, cookie names, URLs) to
  // disk in production, and avoid unbounded log growth on hosted filesystems.
  if (process.env.NODE_ENV !== 'development') return;
  try {
    const line = JSON.stringify({ t: new Date().toISOString(), event, ...data });
    appendFileSync(path.join(process.cwd(), '.auth-debug.log'), line + '\n');
  } catch {
    // logging must never break auth
  }
}
