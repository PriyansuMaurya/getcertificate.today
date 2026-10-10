import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/rate-limit';

// Unique key per test so the module-level Map is never shared across tests.
let seq = 0;
function freshKey(): string {
  seq += 1;
  return `test-${seq}-${Date.now()}`;
}

test('checkRateLimit allows up to the limit then blocks until the window resets', () => {
  const key = freshKey();
  assert.equal(checkRateLimit(key, 3, 1000).allowed, true);
  assert.equal(checkRateLimit(key, 3, 1000).allowed, true);
  assert.equal(checkRateLimit(key, 3, 1000).allowed, true);

  const blocked = checkRateLimit(key, 3, 1000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1, 'reports a positive retry delay when blocked');
});

test('checkRateLimit resets after the window elapses', async () => {
  const key = freshKey();
  assert.equal(checkRateLimit(key, 1, 30).allowed, true);
  assert.equal(checkRateLimit(key, 1, 30).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(checkRateLimit(key, 1, 30).allowed, true);
});

test('clientKeyFromHeaders prefers the first forwarded IP, then x-real-ip, then unknown', () => {
  assert.equal(
    clientKeyFromHeaders((name) => (name === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8' : null)),
    '1.2.3.4'
  );
  assert.equal(
    clientKeyFromHeaders((name) => (name === 'x-real-ip' ? '9.9.9.9' : null)),
    '9.9.9.9'
  );
  assert.equal(clientKeyFromHeaders(() => null), 'unknown');
});
