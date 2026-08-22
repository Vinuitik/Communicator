/**
 * Read side of the OS share-sheet hand-off.
 *
 * public/service-worker.js's handleShareTarget() intercepts the OS share sheet's
 * POST to /app/share-target, pulls the file(s) out of the multipart body, and
 * writes them into a small dedicated IndexedDB (a Blob can't survive a
 * navigation/redirect any other way — the SW and the page it redirects to are
 * different JS contexts). It then 303-redirects to `/app/share?shared=1&shareId=<id>`.
 *
 * ShareLandingPage (components/pages/ShareLandingPage) is the consumer: on mount,
 * read `shareId` off the URL query string and call `takePendingShare(shareId)`
 * once. That returns the shared file(s) and deletes the record — this is a
 * ONE-TIME hand-off, not a cache. Once the user has picked a friend, the page
 * hands the file(s) to `blobOutbox` for the actual upload; this module's job
 * stops at "get the Blob out of the service worker".
 *
 * IMPORTANT: this is a SEPARATE IndexedDB database from db.ts's
 * 'communicator-offline' (outbox/meta/cache/blobOutbox stores) — deliberately
 * not sharing a DB_VERSION with that schema, so this lane doesn't need to
 * coordinate upgrade transactions with the pwa-foundation lane. The schema here
 * (name/version/store) is duplicated verbatim in public/service-worker.js
 * (openShareHandoffDB/putPendingShare) since the SW is a standalone file with no
 * build step and can't import this module — bump BOTH files' DB_VERSION together
 * if this ever changes.
 */

export const SHARE_HANDOFF_DB_NAME = 'communicator-share-handoff';
export const SHARE_HANDOFF_DB_VERSION = 1;
export const SHARE_HANDOFF_STORE = 'pendingShares';

export interface PendingShareFile {
  name: string;
  type: string;
  blob: Blob;
}

export interface PendingShare {
  id: string;
  files: PendingShareFile[];
  title: string;
  text: string;
  ts: number;
}

/**
 * Pure — no IndexedDB. Builds the hand-off record from the multipart FormData a
 * share-target POST body parses into. Exported mainly so it's unit-testable
 * without a real IndexedDB; the service worker has its own inline copy of this
 * shape-building logic (see handleShareTarget() in service-worker.js) since it
 * can't import this file. Field name 'media' must match manifest.json's
 * share_target.params.files[0].name.
 */
export function buildPendingShare(form: FormData, id: string, now: number = Date.now()): PendingShare | null {
  const files = form
    .getAll('media')
    .filter((f): f is File => typeof File !== 'undefined' && f instanceof File && f.size > 0);
  if (files.length === 0) return null;
  return {
    id,
    files: files.map((f) => ({ name: f.name, type: f.type, blob: f })),
    title: (form.get('title') || '').toString(),
    text: (form.get('text') || '').toString(),
    ts: now,
  };
}

function openShareHandoffDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_HANDOFF_DB_NAME, SHARE_HANDOFF_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_HANDOFF_STORE)) {
        db.createObjectStore(SHARE_HANDOFF_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Reads AND deletes the pending share in one transaction — a shareId is a
 * one-time hand-off, never a durable cache. Returns null if the id is missing
 * (e.g. the page was reloaded after already consuming it, or the SW write
 * failed). Call this exactly once, from ShareLandingPage's mount effect.
 */
export async function takePendingShare(id: string): Promise<PendingShare | null> {
  const db = await openShareHandoffDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_HANDOFF_STORE, 'readwrite');
    const store = tx.objectStore(SHARE_HANDOFF_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as PendingShare | undefined;
      if (record) store.delete(id);
      resolve(record ?? null);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
