// Minimal hand-rolled IndexedDB wrapper for the offline outbox — no library, matching
// this repo's other pwa/*.ts modules. Four stores:
//   outbox      — keyPath 'requestId': the unconditional local fallback queue (outbox.ts)
//   meta        — keyPath 'key': Drive bridge cache, device id, blobOutbox index
//   cache       — keyPath 'cacheKey': generic read-through cache (readCache.ts)
//   blobOutbox  — keyPath 'requestId': binary file queue, mirrors `outbox` (blobOutbox.ts)

const DB_NAME = 'communicator-offline';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'requestId' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'cacheKey' });
      if (!db.objectStoreNames.contains('blobOutbox')) db.createObjectStore('blobOutbox', { keyPath: 'requestId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

// ── outbox: the unconditional local fallback queue ─────────────────────────────────

// `kind` was a closed union ('talkedToFriend' | 'addFriend' | 'addKnowledge') until the
// outbox.ts registry refactor — every new page's write kind would otherwise force an edit
// to this union AND outbox.ts's dispatch switch. Now opaque: outbox.ts's registry
// (registerIntentHandler) validates known kinds at replay time, not the type system.
export interface QueuedIntent {
  requestId: string;
  kind: string;
  friendId?: number;
  payload: unknown;
  queuedAt: number;
}

export async function enqueue(intent: QueuedIntent): Promise<void> {
  await tx('outbox', 'readwrite', (store) => store.put(intent));
}

export async function removeFromOutbox(requestId: string): Promise<void> {
  await tx('outbox', 'readwrite', (store) => store.delete(requestId));
}

export async function getAllQueued(): Promise<QueuedIntent[]> {
  return tx('outbox', 'readonly', (store) => store.getAll());
}

// ── meta: Drive bridge cache + device id ────────────────────────────────────────────

export interface DriveBridge {
  accessToken: string;
  expiresAt: number;
  mailboxFolderId: string;
  encryptionKeyBase64: string;
}

interface MetaRow {
  key: string;
  value: unknown;
}

export async function setBridge(bridge: DriveBridge): Promise<void> {
  await tx('meta', 'readwrite', (store) => store.put({ key: 'driveBridge', value: bridge } as MetaRow));
}

export async function getBridge(): Promise<DriveBridge | undefined> {
  const row = await tx<MetaRow>('meta', 'readonly', (store) => store.get('driveBridge'));
  return row?.value as DriveBridge | undefined;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const row = await tx<MetaRow>('meta', 'readonly', (store) => store.get('deviceId'));
  if (row?.value) return row.value as string;
  const id = crypto.randomUUID().slice(0, 12);
  await tx('meta', 'readwrite', (store) => store.put({ key: 'deviceId', value: id } as MetaRow));
  return id;
}

// ── blobOutbox index: tracked separately in `meta` so blobOutbox.ts's flush() can tell
// "a queued blob's row vanished from the store out from under us" (partial eviction) apart
// from "nothing was ever queued." Doesn't help against a full-origin wipe (this index would
// vanish too in that case) — navigator.storage.persist() is the actual defense there; see
// blobOutbox.ts and this module's FLOWS.md Technology Notes. ──────────────────────────────

export async function getBlobOutboxIndex(): Promise<string[]> {
  const row = await tx<MetaRow>('meta', 'readonly', (store) => store.get('blobOutboxIndex'));
  return (row?.value as string[] | undefined) ?? [];
}

export async function setBlobOutboxIndex(ids: string[]): Promise<void> {
  await tx('meta', 'readwrite', (store) => store.put({ key: 'blobOutboxIndex', value: ids } as MetaRow));
}

// ── cache: generic read-through store keyed by an opaque string (readCache.ts) ─────────

export interface CacheEntry<T = unknown> {
  cacheKey: string;
  data: T;
  ts: number;
}

export async function putCache(cacheKey: string, data: unknown): Promise<void> {
  await tx('cache', 'readwrite', (store) => store.put({ cacheKey, data, ts: Date.now() } as CacheEntry));
}

export async function getCache<T = unknown>(cacheKey: string): Promise<CacheEntry<T> | undefined> {
  return tx<CacheEntry<T> | undefined>('cache', 'readonly', (store) => store.get(cacheKey));
}

// ── blobOutbox: binary file queue, mirrors `outbox` but holds a Blob (blobOutbox.ts) ───

export interface QueuedBlob {
  requestId: string;
  friendId: number;
  blob: Blob;
  queuedAt: number;
}

export async function enqueueBlob(item: QueuedBlob): Promise<void> {
  await tx('blobOutbox', 'readwrite', (store) => store.put(item));
}

export async function getAllQueuedBlobs(): Promise<QueuedBlob[]> {
  return tx('blobOutbox', 'readonly', (store) => store.getAll());
}

export async function removeFromBlobOutbox(requestId: string): Promise<void> {
  await tx('blobOutbox', 'readwrite', (store) => store.delete(requestId));
}
