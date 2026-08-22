// Regression test for the outbox.ts registry refactor (closed kind union + hardcoded
// switch -> registerIntentHandler). Proves the 3 pre-existing kinds (talkedToFriend,
// addFriend, addKnowledge) still submit and flush correctly, and that an intent whose
// kind was never registered stays queued instead of crashing flush().

// This Jest environment (jsdom under Node 18, react-scripts' default) doesn't expose a
// global `crypto` — Node only globalized webcrypto in v19+. outbox.ts calls
// crypto.randomUUID() at module scope in every submit* function, unrelated to this
// refactor, but no prior test ever exercised outbox.ts unmocked (QuickLogModal.test.tsx
// etc. all mock offlineApi.ts/outbox.ts wholesale) so this gap was never hit before.
// Polyfilled here rather than in production code — the browser target always has it.
import { webcrypto } from 'crypto';
if (typeof global.crypto === 'undefined') {
  Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true });
}

import { flush, submitAddFriend, submitAddKnowledge, submitTalkedToFriend, registerIntentHandler } from './outbox';
import * as friendService from '../services/api/friendService';
import { isServerReachable } from './connectivity';
import { getAllQueued, QueuedIntent, removeFromOutbox } from './db';
import * as driveClient from './driveClient';

jest.mock('../services/api/friendService', () => ({
  talkedToFriend: jest.fn(),
  addFriend: jest.fn(),
  addFriendKnowledgeItem: jest.fn(),
}));
jest.mock('./connectivity', () => ({ isServerReachable: jest.fn() }));
jest.mock('./db', () => ({
  enqueue: jest.fn(),
  getAllQueued: jest.fn(),
  removeFromOutbox: jest.fn(),
}));
jest.mock('./driveClient', () => ({
  refreshBridge: jest.fn(),
  isAvailable: jest.fn(),
  pushBatch: jest.fn(),
}));

const mockedTalkedToFriend = friendService.talkedToFriend as jest.MockedFunction<typeof friendService.talkedToFriend>;
const mockedAddFriend = friendService.addFriend as jest.MockedFunction<typeof friendService.addFriend>;
const mockedAddKnowledge = friendService.addFriendKnowledgeItem as jest.MockedFunction<
  typeof friendService.addFriendKnowledgeItem
>;
const mockedIsServerReachable = isServerReachable as jest.MockedFunction<typeof isServerReachable>;
const mockedGetAllQueued = getAllQueued as jest.MockedFunction<typeof getAllQueued>;
const mockedRemoveFromOutbox = removeFromOutbox as jest.MockedFunction<typeof removeFromOutbox>;

describe('outbox.ts — submit (direct tier, kind-specific entry points)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsServerReachable.mockResolvedValue(true);
  });

  it('submitTalkedToFriend dispatches to friendService.talkedToFriend', async () => {
    mockedTalkedToFriend.mockResolvedValue(undefined);
    const result = await submitTalkedToFriend(1, { fact: 'x' } as never);
    expect(mockedTalkedToFriend).toHaveBeenCalledWith(1, { fact: 'x' }, expect.any(String));
    expect(result).toEqual({ queued: false, viaDrive: false });
  });

  it('submitAddFriend dispatches to friendService.addFriend', async () => {
    mockedAddFriend.mockResolvedValue(undefined);
    await submitAddFriend({ name: 'New' } as never);
    expect(mockedAddFriend).toHaveBeenCalledWith({ name: 'New' }, expect.any(String));
  });

  it('submitAddKnowledge dispatches to friendService.addFriendKnowledgeItem', async () => {
    mockedAddKnowledge.mockResolvedValue(undefined);
    await submitAddKnowledge(3, 'likes coffee', 5);
    expect(mockedAddKnowledge).toHaveBeenCalledWith(3, 'likes coffee', 5, expect.any(String));
  });
});

describe('outbox.ts — flush (registry-based replay)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsServerReachable.mockResolvedValue(true);
  });

  it('replays all 3 pre-existing kinds via their registered handlers and drains the queue', async () => {
    const queued: QueuedIntent[] = [
      { requestId: 'r1', kind: 'talkedToFriend', friendId: 1, payload: { fact: 'a' }, queuedAt: 1 },
      { requestId: 'r2', kind: 'addFriend', payload: { name: 'Bea' }, queuedAt: 2 },
      { requestId: 'r3', kind: 'addKnowledge', friendId: 2, payload: { fact: 'likes tea', importance: 3 }, queuedAt: 3 },
    ];
    mockedGetAllQueued.mockResolvedValue(queued);
    mockedTalkedToFriend.mockResolvedValue(undefined);
    mockedAddFriend.mockResolvedValue(undefined);
    mockedAddKnowledge.mockResolvedValue(undefined);

    await flush();

    expect(mockedTalkedToFriend).toHaveBeenCalledWith(1, { fact: 'a' }, 'r1');
    expect(mockedAddFriend).toHaveBeenCalledWith({ name: 'Bea' }, 'r2');
    expect(mockedAddKnowledge).toHaveBeenCalledWith(2, 'likes tea', 3, 'r3');
    expect(mockedRemoveFromOutbox).toHaveBeenCalledTimes(3);
    expect(mockedRemoveFromOutbox).toHaveBeenCalledWith('r1');
    expect(mockedRemoveFromOutbox).toHaveBeenCalledWith('r2');
    expect(mockedRemoveFromOutbox).toHaveBeenCalledWith('r3');
  });

  it('a newly registered kind (simulating a Lane-1 page module) replays correctly too', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    registerIntentHandler('scheduleMeeting', handler);
    mockedGetAllQueued.mockResolvedValue([
      { requestId: 'r9', kind: 'scheduleMeeting', payload: { title: 'Sync' }, queuedAt: 9 },
    ]);

    await flush();

    expect(handler).toHaveBeenCalledWith({ title: 'Sync' }, { friendId: undefined, requestId: 'r9' });
    expect(mockedRemoveFromOutbox).toHaveBeenCalledWith('r9');
  });

  it('an intent whose kind was never registered stays queued — flush() does not throw or remove it', async () => {
    mockedGetAllQueued.mockResolvedValue([
      { requestId: 'r-unknown', kind: 'notYetMounted', payload: {}, queuedAt: 1 },
    ]);

    await expect(flush()).resolves.toBeUndefined();
    expect(mockedRemoveFromOutbox).not.toHaveBeenCalled();
  });

  it('does nothing when the queue is empty', async () => {
    mockedGetAllQueued.mockResolvedValue([]);
    await flush();
    expect(driveClient.refreshBridge).not.toHaveBeenCalled();
  });
});
