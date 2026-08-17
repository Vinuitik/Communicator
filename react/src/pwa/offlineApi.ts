// Thin facade over outbox.ts — the seam components call instead of friendService
// directly, so they don't have to branch on connectivity themselves.

import { NewFriendPayload } from '../types/api';
import * as outbox from './outbox';

export interface OfflineWriteResult {
  queued: boolean;
  viaDrive: boolean;
}

export const talkedToFriendOffline = (friendId: number, payload: NewFriendPayload): Promise<OfflineWriteResult> =>
  outbox.submitTalkedToFriend(friendId, payload);

export const addFriendOffline = (payload: NewFriendPayload): Promise<OfflineWriteResult> =>
  outbox.submitAddFriend(payload);

export const addFriendKnowledgeItemOffline = (friendId: number, fact: string, importance: number): Promise<OfflineWriteResult> =>
  outbox.submitAddKnowledge(friendId, fact, importance);
