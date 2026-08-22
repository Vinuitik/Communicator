// Binary-file queue for the share-target flow (ShareLandingPage) — mirrors outbox.ts's
// shape but can't reuse it: crypto.ts's encryptJson() is JSON-only, and a Blob can't
// round-trip through JSON.stringify. So this is a separate IndexedDB store (`blobOutbox`,
// db.ts) holding the raw Blob + metadata, and flush() uploads server-direct only — no
// Drive-relay tier for blobs (the mailbox/bundle Drive artifacts are JSON-only too).
//
// Eviction handling: IndexedDB can be evicted by the browser under storage pressure like
// any other site data. navigator.storage.persist() (requested on first enqueue) reduces
// that risk but doesn't eliminate it. To avoid SILENTLY losing a queued share, this module
// keeps a small index of "requestIds we believe are queued" in db.ts's `meta` store
// (getBlobOutboxIndex/setBlobOutboxIndex) — separate from the `blobOutbox` store itself —
// so flush() can notice "we tracked this id but the row is gone" and report it as `lost`
// rather than just quietly returning an empty result. This does NOT protect against a full
// origin wipe (the index would vanish too); it catches partial eviction of the
// `blobOutbox` store specifically, which is the scenario the plan's test review flagged.

import * as friendService from '../services/api/friendService';
import { enqueueBlob, getAllQueuedBlobs, getBlobOutboxIndex, QueuedBlob, removeFromBlobOutbox, setBlobOutboxIndex } from './db';

export interface EnqueueMeta {
  friendId: number;
  requestId: string;
}

let persistRequested = false;

// Best-effort: unsupported browsers (or a user who's denied it) just skip this — it's a
// risk-reduction measure, not a hard guarantee, and must never block enqueue().
async function requestPersistence(): Promise<void> {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      await navigator.storage.persist();
    }
  } catch {
    // ignore — best-effort only
  }
}

export async function enqueue(blob: Blob, meta: EnqueueMeta): Promise<void> {
  await requestPersistence();
  const item: QueuedBlob = { requestId: meta.requestId, friendId: meta.friendId, blob, queuedAt: Date.now() };
  await enqueueBlob(item);
  const idx = await getBlobOutboxIndex();
  if (!idx.includes(meta.requestId)) {
    await setBlobOutboxIndex([...idx, meta.requestId]);
  }
}

export interface BlobFlushResult {
  /** requestIds that uploaded successfully and were removed from the queue. */
  succeeded: string[];
  /** requestIds that failed this attempt but are still queued — will retry next flush(). */
  failed: string[];
  /**
   * requestIds we were tracking (per the meta-store index) whose row is no longer in the
   * `blobOutbox` store — i.e. evicted between enqueue and flush. These are gone for good;
   * the UI must surface a visible retry/error state (re-share prompt) rather than treating
   * this the same as a plain transient failure.
   */
  lost: string[];
}

export async function flush(): Promise<BlobFlushResult> {
  const trackedIds = await getBlobOutboxIndex();
  const queued = await getAllQueuedBlobs();
  const queuedIds = new Set(queued.map((q) => q.requestId));

  const lost = trackedIds.filter((id) => !queuedIds.has(id));

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const q of queued) {
    try {
      await friendService.uploadFriendFiles(q.friendId, [new File([q.blob], q.requestId, { type: q.blob.type })]);
      await removeFromBlobOutbox(q.requestId);
      succeeded.push(q.requestId);
    } catch {
      failed.push(q.requestId);
    }
  }

  const remaining = trackedIds.filter((id) => !succeeded.includes(id) && !lost.includes(id));
  await setBlobOutboxIndex(remaining);

  return { succeeded, failed, lost };
}

export async function getQueuedCount(): Promise<number> {
  return (await getAllQueuedBlobs()).length;
}
