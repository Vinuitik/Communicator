const APP_URL = 'http://localhost:8090';

export async function waitUntil(check: () => Promise<boolean>, timeoutMs: number, intervalMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
}

export const waitForServerUp = (timeoutMs = 90_000): Promise<void> =>
  waitUntil(async () => {
    try {
      return (await fetch(`${APP_URL}/api/friend/ping`)).ok;
    } catch {
      return false;
    }
  }, timeoutMs);

// A thrown fetch (connection refused/reset) counts as "down" here, unlike waitForServerUp
// above where the same exception means "not up yet" — same helper, opposite meaning per
// check, so this can't share a single blanket try/catch in waitUntil itself.
export const waitForServerDown = (timeoutMs = 30_000): Promise<void> =>
  waitUntil(async () => {
    try {
      return !(await fetch(`${APP_URL}/api/friend/ping`)).ok;
    } catch {
      return true;
    }
  }, timeoutMs);

interface FriendSummary {
  id: number;
  name: string;
}

export async function findFriendByName(name: string): Promise<FriendSummary | undefined> {
  const resp = await fetch(`${APP_URL}/api/friend/allFriends`);
  const friends = (await resp.json()) as FriendSummary[];
  return friends.find((f) => f.name === name);
}

export async function deleteFriend(id: number): Promise<void> {
  await fetch(`${APP_URL}/api/friend/deleteFriend/${id}`, { method: 'DELETE' });
}
