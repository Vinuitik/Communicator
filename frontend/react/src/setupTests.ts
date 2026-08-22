// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom's test environment doesn't expose Node's global `crypto` (Web Crypto API) —
// several pwa/*.ts modules call crypto.randomUUID() for offline write idempotency
// keys (outbox.ts, driveClient.ts, db.ts, ShareLandingPage). Polyfill with Node's
// own implementation so any test that exercises those code paths doesn't need its
// own ad-hoc mock.
if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.randomUUID !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto');
  Object.defineProperty(globalThis, 'crypto', {
    value: { ...(globalThis.crypto ?? {}), randomUUID: () => nodeCrypto.randomUUID() },
    configurable: true,
  });
}
