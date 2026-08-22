// Three-tier offline write dispatcher: direct write -> Drive relay -> local queue.
// Mirrors habitTracker's outbox.js. submit() always "succeeds" from the caller's
// perspective (worst case: locally queued) — a thrown exception from the direct call
// only surfaces if the failure looks like a real error (see connectivity.ts's
// reachability check, which is what gates the direct-call attempt in the first place).
//
// Kind dispatch is registry-based (registerIntentHandler), not a closed union + switch —
// see the Change Index / FLOWS.md. This lets each page module add its own write kind
// without ever editing this file, which used to be the single highest-risk merge-conflict
// point when multiple pages' offline wiring landed in parallel.

import { NewFriendPayload } from '../types/api';
import * as friendService from '../services/api/friendService';
import { isServerReachable } from './connectivity';
import { enqueue, getAllQueued, QueuedIntent, removeFromOutbox } from './db';
import * as driveClient from './driveClient';

export interface SubmitResult {
  queued: boolean;
  viaDrive: boolean;
}

// Handlers get the full context (friendId, requestId), not just payload — talkedToFriend
// and addKnowledge need friendId, and every direct call needs requestId for the server's
// idempotency ledger (ConsumedWriteRequestService). A payload-only signature can't replay
// the existing 3 kinds unchanged, which the refactor requires.
export type IntentHandler = (payload: unknown, ctx: { friendId?: number; requestId: string }) => Promise<void>;

const intentHandlers = new Map<string, IntentHandler>();

// Each page module calls this once (e.g. at module load) to register how ITS kind replays
// on flush() — outbox.ts never needs to know about friendService/meetingService/etc.
export function registerIntentHandler(kind: string, handler: IntentHandler): void {
  intentHandlers.set(kind, handler);
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
  const handler = intentHandlers.get(q.kind);
  if (!handler) {
    // Not registered (yet) — e.g. a lazy-loaded page's module hasn't mounted this session,
    // so it never called registerIntentHandler. Throw so flush()'s per-item catch leaves
    // this one queued for the next attempt instead of dropping it silently.
    throw new Error(`outbox: no handler registered for intent kind "${q.kind}"`);
  }
  await handler(q.payload, { friendId: q.friendId, requestId: q.requestId });
}

// The 3 kinds that predate the registry — re-registered here with their exact prior
// dispatch logic (was a hardcoded switch in replayDirect) so this is a pure refactor,
// not a behavior change.
registerIntentHandler('talkedToFriend', (payload, ctx) =>
  friendService.talkedToFriend(ctx.friendId!, payload as NewFriendPayload, ctx.requestId),
);
registerIntentHandler('addFriend', (payload, ctx) => friendService.addFriend(payload as NewFriendPayload, ctx.requestId));
registerIntentHandler('addKnowledge', (payload, ctx) => {
  const { fact, importance } = payload as { fact: string; importance: number };
  return friendService.addFriendKnowledgeItem(ctx.friendId!, fact, importance, ctx.requestId);
});

// Keeps a fresh Drive bridge token cached in the browser WHILE the server is healthy, so a
// valid token is already on hand the instant the server goes down. Without this, submit()/
// flush() only ever ask for a bridge token AFTER already noticing the server is unreachable —
// but the bridge-mint endpoint (/backup/sync/bridge) lives in the same monolith as everything
// else, so by then it's down too and the Drive relay tier can never engage on a cold outage.
async function keepBridgeWarm(): Promise<void> {
  if (!(await isServerReachable())) return;
  if (await driveClient.isAvailable()) return;
  await driveClient.refreshBridge();
}

let wired = false;

// Wire-up: one call in src/index.tsx, alongside registerServiceWorker().
export function wireAutoFlush(): void {
  if (wired) return;
  wired = true;
  window.addEventListener('online', () => {
    void keepBridgeWarm();
    void flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void keepBridgeWarm();
      void flush();
    }
  });
  window.setInterval(() => {
    void keepBridgeWarm();
    void flush();
  }, 60_000);
  void keepBridgeWarm();
  void flush();
}
