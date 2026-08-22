// Drive-pull read tier — the last resort in readCache.ts's readThrough(), only consulted
// when BOTH the server and the local `cache` store have missed (new device, evicted
// storage). Mirrors ObsidianOptimizer's drivePull.js. Reads the encrypted snapshot bundle
// BundleExportService (services/backup) writes on a schedule — see
// docs/designs/offline-pwa-plan.md's T0 section for the bundle JSON shape, reproduced here.

import { decryptJson } from './crypto';
import { getBridge } from './db';
import { pullBundle, refreshBridge } from './driveClient';

export interface BundleEntityRow<T = unknown> {
  id: number;
  data: T;
  updatedAt: string;
}

export interface OfflineBundle {
  bundleVersion: number;
  exportedAt: string;
  entities: {
    friends: BundleEntityRow[];
    groups: BundleEntityRow[];
    connections: BundleEntityRow[];
    meetings: BundleEntityRow[];
    settings: { data: unknown; updatedAt: string };
  };
}

type PluralEntityKey = 'friends' | 'groups' | 'connections' | 'meetings';

// Maps both singular and plural cacheKey prefixes ('friend:42' AND 'friends:list') onto
// the bundle's plural entity arrays.
const ENTITY_KEY_MAP: Record<string, PluralEntityKey> = {
  friend: 'friends',
  friends: 'friends',
  group: 'groups',
  groups: 'groups',
  connection: 'connections',
  connections: 'connections',
  meeting: 'meetings',
  meetings: 'meetings',
};

// Parses the cacheKey conventions readCache.ts's callers use:
//   'friend:42'                        -> single row lookup by id in entities.friends
//   'friends:list'                     -> the whole entities.friends array
//   'meetings:2026-08-18..2026-08-24'  -> non-numeric id part; the bundle has no range
//                                          filter, so return the whole collection and let
//                                          the caller filter client-side
//   'settings'                          -> entities.settings.data
export function resolveFromBundle(bundle: OfflineBundle, cacheKey: string): unknown {
  const [typePart, idPart] = cacheKey.split(':');

  if (typePart === 'settings') return bundle.entities.settings?.data;

  const entityKey = ENTITY_KEY_MAP[typePart];
  if (!entityKey) return undefined;
  const rows = bundle.entities[entityKey];
  if (!rows) return undefined;

  if (idPart === undefined) return rows.map((r) => r.data);

  const id = Number(idPart);
  if (Number.isNaN(id)) {
    // Non-numeric id part ('list', a date range, ...) — bundle can't filter these, hand
    // back the full collection.
    return rows.map((r) => r.data);
  }
  return rows.find((r) => r.id === id)?.data;
}

export async function pullFromDrive(cacheKey: string): Promise<unknown> {
  await refreshBridge();

  const bytes = await pullBundle();
  if (!bytes) return undefined;

  const bridge = await getBridge();
  if (!bridge) return undefined;

  let bundle: OfflineBundle;
  try {
    bundle = await decryptJson<OfflineBundle>(bridge.encryptionKeyBase64, bytes);
  } catch {
    // Corrupt/undecryptable bundle (partial write, key mismatch) — treat as a miss, not
    // a crash. The caller (readCache.ts) renders an empty state same as any other miss.
    return undefined;
  }

  return resolveFromBundle(bundle, cacheKey);
}
