// Drive relay tier for the offline outbox — modeled on habitTracker's driveClient.js.
// Never calls Google's OAuth token endpoint directly: the only Drive credential this
// module ever holds is the short-lived access token handed out by
// GET /backup/sync/bridge (BackupController.syncBridge), cached with a safety margin
// against its expiry. The durable refresh token + client secret stay server-side.

import { API_BASE } from '../services/api/config';
import { encryptJson } from './crypto';
import { DriveBridge, getBridge, getOrCreateDeviceId, setBridge } from './db';

const EXPIRY_SAFETY_MARGIN_MS = 60_000;

export async function refreshBridge(): Promise<DriveBridge | null> {
  try {
    const resp = await fetch(`${API_BASE.BACKUP}/sync/bridge`, { cache: 'no-store' });
    // 409 = Drive not connected or encryption not configured — not an error, just
    // "relay tier unavailable", same as any other failure to refresh here.
    if (!resp.ok) return null;
    const bridge = (await resp.json()) as DriveBridge;
    await setBridge(bridge);
    return bridge;
  } catch {
    return null;
  }
}

export async function isAvailable(): Promise<boolean> {
  const bridge = await getBridge();
  if (!bridge) return false;
  return bridge.expiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now();
}

export interface MailboxRequest {
  requestId: string;
  // Opaque, same as db.ts's QueuedIntent.kind post-registry-refactor — the mailbox relay
  // just serializes whatever kind outbox.ts hands it, never branches on it itself.
  kind: string;
  friendId?: number;
  payload: unknown;
}

// Batches everything queued into ONE Drive push (see outbox.ts flush()) rather than
// one file per intent — matches both source projects' shape.
export async function pushBatch(requests: MailboxRequest[]): Promise<void> {
  const bridge = await getBridge();
  if (!bridge) throw new Error('No Drive bridge cached — call refreshBridge() first');

  const deviceId = await getOrCreateDeviceId();
  const encrypted = await encryptJson(bridge.encryptionKeyBase64, { deviceId, requests });
  const name = `${deviceId}-${Date.now()}.enc`;

  await uploadToMailbox(bridge.accessToken, bridge.mailboxFolderId, name, encrypted);
}

async function uploadToMailbox(accessToken: string, folderId: string, name: string, bytes: Uint8Array): Promise<void> {
  const boundary = `outbox-${crypto.randomUUID()}`;
  const metadata = { name, parents: [folderId] };
  const encoder = new TextEncoder();

  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!resp.ok) {
    throw new Error(`Drive upload failed: ${resp.status}`);
  }
}

// Filename BundleExportService (services/backup) writes the read-tier snapshot bundle
// under — same folder as the mailbox (bridge.mailboxFolderId), different name, so the two
// never collide. See docs/designs/offline-pwa-plan.md's T0 section for the bundle shape.
const BUNDLE_FILE_NAME = 'offline-bundle.json.enc';

// Read-tier counterpart to pushBatch() above — used only by drivePull.ts, only when both
// the server AND the local `cache` store have missed. Returns null (not a throw) for every
// "nothing to pull" case (no bridge, file not found, request failed) so callers can treat
// it as a plain cache miss rather than an error.
export async function pullBundle(): Promise<Uint8Array | null> {
  const bridge = await getBridge();
  if (!bridge) return null;

  let listResp: Response;
  try {
    listResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name='${BUNDLE_FILE_NAME}' and '${bridge.mailboxFolderId}' in parents and trashed=false`,
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${bridge.accessToken}` } },
    );
  } catch {
    return null;
  }
  if (!listResp.ok) return null;

  const { files } = (await listResp.json()) as { files?: { id: string }[] };
  const fileId = files?.[0]?.id;
  if (!fileId) return null;

  try {
    const fileResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${bridge.accessToken}` },
    });
    if (!fileResp.ok) return null;
    return new Uint8Array(await fileResp.arrayBuffer());
  } catch {
    return null;
  }
}
