import { test, expect, Page } from '@playwright/test';
import { stopContainer, startContainer } from '../docker';
import { waitForServerDown, waitForServerUp, findFriendByName, deleteFriend } from '../wait';

// Exercises the actual three-tier write path (react/src/pwa/outbox.ts) against the real
// docker-compose stack — the two tiers a fresh browser session can genuinely reach:
//
//   1. Cold outage (no cached Drive token yet) -> local IndexedDB queue -> flush on recovery
//   2. Warm bridge (token cached while server was healthy) -> Drive relay -> MailboxConsumeService
//      drains it once the server restarts
//
// See tasks/SYNC_ENGINE_TESTING_HANDOFF.md for the wider context and
// MailboxConsumeServiceTest.java for the unit-level coverage this complements.
const APP_CONTAINER = 'communicator-app';

interface QueuedIntentRow {
  requestId: string;
  kind: string;
  payload: unknown;
}

async function readOutboxStore(page: Page): Promise<QueuedIntentRow[]> {
  return page.evaluate(
    () =>
      new Promise<QueuedIntentRow[]>((resolve, reject) => {
        const req = indexedDB.open('communicator-offline');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('outbox')) {
            resolve([]);
            return;
          }
          const getAllReq = db.transaction('outbox', 'readonly').objectStore('outbox').getAll();
          getAllReq.onsuccess = () => resolve(getAllReq.result as QueuedIntentRow[]);
          getAllReq.onerror = () => reject(getAllReq.error);
        };
      }),
  );
}

async function fillAndSubmitAddFriendForm(page: Page, name: string): Promise<void> {
  await page.goto('friends/add');
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="lastSpoken"]').fill(new Date().toISOString().slice(0, 10));
  await page.locator('input[name="hours"]').fill('1');
  await page.getByRole('button', { name: 'Save friend' }).click();
}

test.describe('offline outbox — three-tier write path', () => {
  test.beforeAll(async () => {
    await startContainer(APP_CONTAINER);
    await waitForServerUp();
  });

  test.afterEach(async () => {
    // Safety net regardless of pass/fail: leave the real app running for the user.
    await startContainer(APP_CONTAINER).catch(() => {});
    await waitForServerUp().catch(() => {});
  });

  test('cold outage: write queues locally (no Drive token cached yet) and flushes on recovery', async ({ page }) => {
    const name = `E2E-Cold-${Date.now()}`;

    // Stopping before the first navigation is what makes this "cold" — the app's proactive
    // bridge-warming (outbox.ts's keepBridgeWarm, called from wireAutoFlush on load) never
    // gets a chance to run against a live server, so there's no cached Drive token available.
    await stopContainer(APP_CONTAINER);
    await waitForServerDown();

    await fillAndSubmitAddFriendForm(page, name);

    await expect(async () => {
      const queued = await readOutboxStore(page);
      expect(queued.some((q) => q.kind === 'addFriend' && (q.payload as { name?: string }).name === name)).toBe(true);
    }).toPass({ timeout: 10_000 });

    await startContainer(APP_CONTAINER);
    await waitForServerUp();

    // A reload is what actually triggers the drain here: wireAutoFlush() calls flush() once
    // immediately on load, same as a user reopening the tab after connectivity returns.
    await page.reload();

    let friend: { id: number } | undefined;
    await expect(async () => {
      friend = await findFriendByName(name);
      expect(friend).toBeTruthy();
    }).toPass({ timeout: 30_000 });

    if (friend) await deleteFriend(friend.id);
  });

  test('warm bridge: write relays through Drive while server is down, drained by MailboxConsumeService on restart', async ({ page }) => {
    const name = `E2E-Warm-${Date.now()}`;

    // Load the app while the server is healthy so keepBridgeWarm() has a real chance to mint
    // and cache a Drive bridge token before the outage — this is the behavior the proactive-
    // caching fix (outbox.ts) exists for.
    const bridgeWarmed = page.waitForResponse((r) => r.url().includes('/backup/sync/bridge') && r.ok(), { timeout: 15_000 });
    await page.goto('');
    await bridgeWarmed;

    await stopContainer(APP_CONTAINER);
    await waitForServerDown();

    const driveUpload = page.waitForResponse((r) => r.url().includes('googleapis.com/upload/drive') && r.ok(), { timeout: 15_000 });
    await fillAndSubmitAddFriendForm(page, name);
    await driveUpload;

    // Confirms it went via Drive, not the local queue.
    const queued = await readOutboxStore(page);
    expect(queued.some((q) => (q.payload as { name?: string }).name === name)).toBe(false);

    await startContainer(APP_CONTAINER);
    await waitForServerUp();

    let friend: { id: number } | undefined;
    // MailboxConsumeService.onReady() runs on boot, but listing/downloading/decrypting the
    // Drive file and applying the write still takes a few seconds past "server is up".
    await expect(async () => {
      friend = await findFriendByName(name);
      expect(friend).toBeTruthy();
    }).toPass({ timeout: 60_000 });

    if (friend) await deleteFriend(friend.id);
  });
});
