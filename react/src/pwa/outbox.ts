// Three-tier offline write dispatcher: direct write -> Drive relay -> local queue.
// Mirrors habitTracker's outbox.js. submit() always "succeeds" from the caller's
// perspective (worst case: locally queued) — a thrown exception from the direct call
// only surfaces if the failure looks like a real error (see connectivity.ts's
// reachability check, which is what gates the direct-call attempt in the first place).

import { NewFriendPayload } from '../types/api';
import * as friendService from '../services/api/friendService';
import { isServerReachable } from './connectivity';
import { enqueue, getAllQueued, QueuedIntent, removeFromOutbox } from './db';
import * as driveClient from './driveClient';

export interface SubmitResult {
  queued: boolean;
  viaDrive: boolean;
}

async function submit(intent: Omit<QueuedIntent, 'queuedAt'>, sendDirect: () => Promise<void>): Promise<SubmitResult> {
  if (await isServerReachable()) {
    try {
      await sendDirect();
      return { queued: false, viaDrive: false };
    } catch {
      // Fall through to the relay/queue below — same handling as an unreachable server.
    }
  }

  await driveClient.refreshBridge();
  if (await driveClient.isAvailable()) {
    try {
      await driveClient.pushBatch([{ requestId: intent.requestId, kind: intent.kind, friendId: intent.friendId, payload: intent.payload }]);
      return { queued: true, viaDrive: true };
    } catch {
      // Fall through to the local queue — the unconditional fallback.
    }
  }

  await enqueue({ ...intent, queuedAt: Date.now() });
  return { queued: true, viaDrive: false };
}

export async function submitTalkedToFriend(friendId: number, payload: NewFriendPayload): Promise<SubmitResult> {
  const requestId = crypto.randomUUID();
  return submit({ requestId, kind: 'talkedToFriend', friendId, payload }, () =>
    friendService.talkedToFriend(friendId, payload, requestId),
  );
}

export async function submitAddFriend(payload: NewFriendPayload): Promise<SubmitResult> {
  const requestId = crypto.randomUUID();
  return submit({ requestId, kind: 'addFriend', payload }, () => friendService.addFriend(payload, requestId));
}

export async function submitAddKnowledge(friendId: number, fact: string, importance: number): Promise<SubmitResult> {
  const requestId = crypto.randomUUID();
  return submit({ requestId, kind: 'addKnowledge', friendId, payload: { fact, importance } }, () =>
    friendService.addFriendKnowledgeItem(friendId, fact, importance, requestId),
  );
}

// Drains the local queue only (the unconditional fallback tier) — batches everything
// into one Drive push if the relay is available, else replays direct one at a time.
export async function flush(): Promise<void> {
  const queued = await getAllQueued();
  if (queued.length === 0) return;

  if (!(await isServerReachable())) {
    await driveClient.refreshBridge();
    if (await driveClient.isAvailable()) {
      try {
        await driveClient.pushBatch(
          queued.map((q) => ({ requestId: q.requestId, kind: q.kind, friendId: q.friendId, payload: q.payload })),
        );
        await Promise.all(queued.map((q) => removeFromOutbox(q.requestId)));
      } catch {
        // Leave everything queued for the next flush attempt.
      }
    }
    return;
  }

  for (const q of queued) {
    try {
      await replayDirect(q);
      await removeFromOutbox(q.requestId);
    } catch {
      // Leave this one queued, keep draining the rest.
    }
  }
}

async function replayDirect(q: QueuedIntent): Promise<void> {
  switch (q.kind) {
    case 'talkedToFriend':
      await friendService.talkedToFriend(q.friendId!, q.payload as NewFriendPayload, q.requestId);
      return;
    case 'addFriend':
      await friendService.addFriend(q.payload as NewFriendPayload, q.requestId);
      return;
    case 'addKnowledge': {
      const { fact, importance } = q.payload as { fact: string; importance: number };
      await friendService.addFriendKnowledgeItem(q.friendId!, fact, importance, q.requestId);
      return;
    }
  }
}

let wired = false;

// Wire-up: one call in src/index.tsx, alongside registerServiceWorker().
export function wireAutoFlush(): void {
  if (wired) return;
  wired = true;
  window.addEventListener('online', () => {
    void flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
  window.setInterval(() => {
    void flush();
  }, 60_000);
  void flush();
}
