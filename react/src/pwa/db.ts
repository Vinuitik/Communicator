// Minimal hand-rolled IndexedDB wrapper for the offline outbox — no library, matching
// this repo's other pwa/*.ts modules. Two stores:
//   outbox — keyPath 'requestId': the unconditional local fallback queue (outbox.ts)
//   meta   — keyPath 'key': caches the Drive bridge bundle + a stable per-browser device id

const DB_NAME = 'communicator-offline';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'requestId' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
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

export interface QueuedIntent {
  requestId: string;
  kind: 'talkedToFriend' | 'addFriend' | 'addKnowledge';
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
