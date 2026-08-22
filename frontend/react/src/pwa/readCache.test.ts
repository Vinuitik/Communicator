import { readThrough } from './readCache';
import { isServerReachable } from './connectivity';
import { getCache, putCache } from './db';
import { pullFromDrive } from './drivePull';

jest.mock('./connectivity', () => ({ isServerReachable: jest.fn() }));
jest.mock('./db', () => ({ getCache: jest.fn(), putCache: jest.fn() }));
jest.mock('./drivePull', () => ({ pullFromDrive: jest.fn() }));

const mockedIsServerReachable = isServerReachable as jest.MockedFunction<typeof isServerReachable>;
const mockedGetCache = getCache as jest.MockedFunction<typeof getCache>;
const mockedPutCache = putCache as jest.MockedFunction<typeof putCache>;
const mockedPullFromDrive = pullFromDrive as jest.MockedFunction<typeof pullFromDrive>;

describe('readThrough', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('server-hit: calls fetchFn, writes through to cache, returns the result', async () => {
    mockedIsServerReachable.mockResolvedValue(true);
    const fetchFn = jest.fn().mockResolvedValue({ id: 42, name: 'Ada' });

    const result = await readThrough('friend:42', fetchFn);

    expect(result).toEqual({ id: 42, name: 'Ada' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(mockedPutCache).toHaveBeenCalledWith('friend:42', { id: 42, name: 'Ada' });
    expect(mockedPullFromDrive).not.toHaveBeenCalled();
  });

  it('cache-hit: server unreachable, returns the cached value without touching Drive', async () => {
    mockedIsServerReachable.mockResolvedValue(false);
    mockedGetCache.mockResolvedValue({ cacheKey: 'friends:list', data: [{ id: 1 }], ts: 123 });
    const fetchFn = jest.fn();

    const result = await readThrough('friends:list', fetchFn);

    expect(result).toEqual([{ id: 1 }]);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(mockedPullFromDrive).not.toHaveBeenCalled();
  });

  it('cache-miss + drivePull-hit: falls through to Drive, populates cache, returns the pulled value', async () => {
    mockedIsServerReachable.mockResolvedValue(false);
    mockedGetCache.mockResolvedValue(undefined);
    mockedPullFromDrive.mockResolvedValue({ id: 7, name: 'Grace' });

    const result = await readThrough('friend:7', jest.fn());

    expect(result).toEqual({ id: 7, name: 'Grace' });
    expect(mockedPullFromDrive).toHaveBeenCalledWith('friend:7');
    expect(mockedPutCache).toHaveBeenCalledWith('friend:7', { id: 7, name: 'Grace' });
  });

  it('cache-miss + drivePull-miss: throws so the caller can render an empty state', async () => {
    mockedIsServerReachable.mockResolvedValue(false);
    mockedGetCache.mockResolvedValue(undefined);
    mockedPullFromDrive.mockResolvedValue(undefined);

    await expect(readThrough('friend:999', jest.fn())).rejects.toThrow();
    expect(mockedPutCache).not.toHaveBeenCalled();
  });

  it('server reachable but fetchFn throws: falls through to cache tier instead of rejecting', async () => {
    mockedIsServerReachable.mockResolvedValue(true);
    const fetchFn = jest.fn().mockRejectedValue(new Error('500'));
    mockedGetCache.mockResolvedValue({ cacheKey: 'friend:1', data: { id: 1 }, ts: 1 });

    const result = await readThrough('friend:1', fetchFn);

    expect(result).toEqual({ id: 1 });
  });
});
