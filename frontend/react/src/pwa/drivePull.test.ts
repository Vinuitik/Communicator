import { pullFromDrive, resolveFromBundle, OfflineBundle } from './drivePull';
import { getBridge } from './db';
import { pullBundle, refreshBridge } from './driveClient';
import { decryptJson } from './crypto';

jest.mock('./db', () => ({ getBridge: jest.fn() }));
jest.mock('./driveClient', () => ({
  pullBundle: jest.fn(),
  refreshBridge: jest.fn(),
}));
jest.mock('./crypto', () => ({ decryptJson: jest.fn() }));

const mockedGetBridge = getBridge as jest.MockedFunction<typeof getBridge>;
const mockedPullBundle = pullBundle as jest.MockedFunction<typeof pullBundle>;
const mockedRefreshBridge = refreshBridge as jest.MockedFunction<typeof refreshBridge>;
const mockedDecryptJson = decryptJson as jest.MockedFunction<typeof decryptJson>;

const sampleBundle: OfflineBundle = {
  bundleVersion: 1,
  exportedAt: '2026-08-22T00:00:00Z',
  entities: {
    friends: [
      { id: 1, data: { id: 1, name: 'Ada' }, updatedAt: '2026-08-01T00:00:00Z' },
      { id: 42, name: 'irrelevant top-level field, ignored' } as never,
    ],
    groups: [],
    connections: [],
    meetings: [{ id: 5, data: { id: 5, title: 'Coffee' }, updatedAt: '2026-08-10T00:00:00Z' }],
    settings: { data: { theme: 'dark' }, updatedAt: '2026-08-01T00:00:00Z' },
  },
};

describe('pullFromDrive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRefreshBridge.mockResolvedValue(null);
    mockedGetBridge.mockResolvedValue({
      accessToken: 'tok',
      expiresAt: Date.now() + 100000,
      mailboxFolderId: 'folder1',
      encryptionKeyBase64: 'key==',
    });
  });

  it('bundle exists: decrypts and resolves the requested entity', async () => {
    mockedPullBundle.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockedDecryptJson.mockResolvedValue(sampleBundle);

    const result = await pullFromDrive('friend:1');

    expect(result).toEqual({ id: 1, name: 'Ada' });
  });

  it('bundle missing: pullBundle returns null, resolves to undefined without decrypting', async () => {
    mockedPullBundle.mockResolvedValue(null);

    const result = await pullFromDrive('friend:1');

    expect(result).toBeUndefined();
    expect(mockedDecryptJson).not.toHaveBeenCalled();
  });

  it('decrypt fails: bundle bytes present but decryptJson throws, resolves to undefined (treated as a miss)', async () => {
    mockedPullBundle.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockedDecryptJson.mockRejectedValue(new Error('bad tag'));

    const result = await pullFromDrive('friend:1');

    expect(result).toBeUndefined();
  });
});

describe('resolveFromBundle (cacheKey convention parsing)', () => {
  it("'friend:<id>' resolves a single row", () => {
    expect(resolveFromBundle(sampleBundle, 'friend:1')).toEqual({ id: 1, name: 'Ada' });
  });

  it("'friends:list' resolves the whole collection's data", () => {
    const result = resolveFromBundle(sampleBundle, 'friends:list') as unknown[];
    expect(result).toHaveLength(2);
  });

  it("'settings' resolves entities.settings.data directly", () => {
    expect(resolveFromBundle(sampleBundle, 'settings')).toEqual({ theme: 'dark' });
  });

  it('a date-range cacheKey falls back to the whole collection (bundle has no range filter)', () => {
    const result = resolveFromBundle(sampleBundle, 'meetings:2026-08-18..2026-08-24') as unknown[];
    expect(result).toEqual([{ id: 5, title: 'Coffee' }]);
  });

  it('unknown entity prefix resolves to undefined', () => {
    expect(resolveFromBundle(sampleBundle, 'unknownThing:1')).toBeUndefined();
  });
});
