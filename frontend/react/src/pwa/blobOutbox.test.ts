import { enqueue, flush } from './blobOutbox';
import * as friendService from '../services/api/friendService';
import {
  enqueueBlob,
  getAllQueuedBlobs,
  getBlobOutboxIndex,
  QueuedBlob,
  removeFromBlobOutbox,
  setBlobOutboxIndex,
} from './db';

jest.mock('../services/api/friendService', () => ({ uploadFriendFiles: jest.fn() }));
jest.mock('./db', () => ({
  enqueueBlob: jest.fn(),
  getAllQueuedBlobs: jest.fn(),
  getBlobOutboxIndex: jest.fn(),
  removeFromBlobOutbox: jest.fn(),
  setBlobOutboxIndex: jest.fn(),
}));

const mockedUpload = friendService.uploadFriendFiles as jest.MockedFunction<typeof friendService.uploadFriendFiles>;
const mockedEnqueueBlob = enqueueBlob as jest.MockedFunction<typeof enqueueBlob>;
const mockedGetAllQueuedBlobs = getAllQueuedBlobs as jest.MockedFunction<typeof getAllQueuedBlobs>;
const mockedGetIndex = getBlobOutboxIndex as jest.MockedFunction<typeof getBlobOutboxIndex>;
const mockedSetIndex = setBlobOutboxIndex as jest.MockedFunction<typeof setBlobOutboxIndex>;
const mockedRemove = removeFromBlobOutbox as jest.MockedFunction<typeof removeFromBlobOutbox>;

const persistMock = jest.fn().mockResolvedValue(true);

beforeAll(() => {
  Object.defineProperty(navigator, 'storage', {
    value: { persist: persistMock },
    configurable: true,
  });
});

describe('blobOutbox.enqueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIndex.mockResolvedValue([]);
  });

  it('requests storage persistence and writes the blob + updates the tracked index', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });

    await enqueue(blob, { friendId: 5, requestId: 'req-1' });

    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(mockedEnqueueBlob).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-1', friendId: 5, blob }),
    );
    expect(mockedSetIndex).toHaveBeenCalledWith(['req-1']);
  });
});

describe('blobOutbox.flush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads each queued blob via uploadFriendFiles and removes it on success', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const item: QueuedBlob = { requestId: 'req-1', friendId: 5, blob, queuedAt: 1 };
    mockedGetIndex.mockResolvedValue(['req-1']);
    mockedGetAllQueuedBlobs.mockResolvedValue([item]);
    mockedUpload.mockResolvedValue(undefined);

    const result = await flush();

    expect(mockedUpload).toHaveBeenCalledWith(5, expect.any(Array));
    expect(mockedRemove).toHaveBeenCalledWith('req-1');
    expect(result.succeeded).toEqual(['req-1']);
    expect(result.failed).toEqual([]);
    expect(result.lost).toEqual([]);
  });

  it('a transient upload failure leaves the blob queued and reports it as failed, not lost', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const item: QueuedBlob = { requestId: 'req-2', friendId: 5, blob, queuedAt: 1 };
    mockedGetIndex.mockResolvedValue(['req-2']);
    mockedGetAllQueuedBlobs.mockResolvedValue([item]);
    mockedUpload.mockRejectedValue(new Error('network'));

    const result = await flush();

    expect(mockedRemove).not.toHaveBeenCalled();
    expect(result.failed).toEqual(['req-2']);
    expect(result.lost).toEqual([]);
    // still tracked for the next flush attempt
    expect(mockedSetIndex).toHaveBeenCalledWith(['req-2']);
  });

  it('simulated eviction: a tracked requestId whose row is gone from blobOutbox is reported as lost, not silently dropped', async () => {
    // Simulates storage pressure clearing the `blobOutbox` object store while the
    // separate `meta` index (tracked ids) survives — the exact partial-eviction scenario
    // this module's eviction guard exists to catch.
    mockedGetIndex.mockResolvedValue(['req-evicted']);
    mockedGetAllQueuedBlobs.mockResolvedValue([]); // store was cleared out from under us

    const result = await flush();

    expect(result.lost).toEqual(['req-evicted']);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([]);
    // the lost id is dropped from the tracked index too — nothing left to retry
    expect(mockedSetIndex).toHaveBeenCalledWith([]);
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});
