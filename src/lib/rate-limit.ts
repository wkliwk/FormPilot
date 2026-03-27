/**
 * In-memory per-user rate limiter using a sliding window.
 *
 * Acceptable for single Vercel function instances (issue #24).
 * Each user is allowed LIMIT requests within WINDOW_MS.
 */

const WINDOW_MS = 60_000; // 1 minute
const LIMIT = 10; // requests per window

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

/**
 * Prune timestamps older than the current window and remove empty entries.
 * Called on every check — no separate interval needed in edge/serverless envs.
 */
function pruneUser(entry: WindowEntry, now: number): void {
  const cutoff = now - WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

/**
 * Remove users whose request windows have fully expired.
 * Called periodically to prevent unbounded memory growth.
 */
function pruneStore(): void {
  const now = Date.now();
  for (const [userId, entry] of store.entries()) {
    pruneUser(entry, now);
    if (entry.timestamps.length === 0) {
      store.delete(userId);
    }
  }
}

// Clean up stale entries every 5 minutes.
// Using setInterval with unref() so it does not keep the process alive.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(pruneStore, 5 * 60_000);
  // unref is available in Node.js but not in all edge runtimes — guard safely
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as NodeJS.Timeout).unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest request in the window expires, present when not allowed. */
  retryAfter?: number;
}

/**
 * Check whether `userId` is within the rate limit.
 * Records the current request if allowed.
 */
export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();

  let entry = store.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(userId, entry);
  }

  pruneUser(entry, now);

  if (entry.timestamps.length >= LIMIT) {
    // Oldest timestamp in the current window determines when a slot opens up
    const oldestTs = entry.timestamps[0];
    const retryAfter = Math.ceil((oldestTs + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: retryAfter > 0 ? retryAfter : 1 };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}
