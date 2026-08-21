import { defineConfig } from '@playwright/test';

// Whole-system E2E for the offline-outbox sync engine (tasks/SYNC_ENGINE_TESTING_HANDOFF.md).
// Runs against the real docker-compose stack on localhost:8090, not a spun-up-for-the-test
// server — these tests stop/start the real communicator-app container mid-run to simulate
// an outage. workers: 1 because both tests in this suite drive that same shared container
// and must never overlap.
export default defineConfig({
  testDir: './tests',
  // Generous: each test does a real container stop + restart (JVM boot + Drive round trip
  // for the warm-bridge case), and this suite runs right after the full Maven reactor build
  // in scripts/run-all-tests.sh, which can still have the Docker daemon under load.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    // The SPA is mounted under /app (React Router basename="/app", CRA `homepage` field) —
    // bare "/" 302s there via nginx's catch-all, dropping any path after it. Keep the
    // trailing slash so relative goto()s below (no leading "/") resolve under /app/.
    baseURL: 'http://localhost:8090/app/',
  },
});
