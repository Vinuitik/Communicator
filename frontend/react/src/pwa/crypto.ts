// AES-256-GCM encryption for the offline-outbox Drive relay (driveClient.ts).
//
// Must match backup/src/main/java/communicate/backup/crypto/EncryptionService.java
// byte-for-byte: gzip the plaintext, then AES-GCM encrypt with a random 12-byte IV,
// wire format [12B IV][ciphertext + 16B GCM tag]. There is no version negotiation —
// any mismatch here means the server's decrypt() breaks silently.
//
// The key itself is never generated client-side — it's the same key nightly backups
// use, handed down once per bridge refresh by GET /backup/sync/bridge (see
// EncryptionService.exportKeyBase64 / BackupController.syncBridge).

async function importKey(keyBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(compressed);
}

export async function encryptJson(keyBase64: string, value: unknown): Promise<Uint8Array> {
  const key = await importKey(keyBase64);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const compressed = await gzip(plaintext);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, compressed);

  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), iv.length);
  return out;
}
