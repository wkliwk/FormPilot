/**
 * In-memory rate limiters using a sliding window.
 *
 * Acceptable for single Vercel function instances (issue #24).
 * Two limiters:
 *  - per-user (authenticated): 10 requests/minute
 *  - per-IP (unauthenticated): 20 requests/hour — launch-day abuse protection
 */

const USER_WINDOW_MS = 60_000; // 1 minute
const USER_LIMIT = 10; // requests per window

const IP_WINDOW_MS = 60 * 60_000; // 1 hour
const IP_LIMIT = 20; // unauthenticated requests per IP per hour

interface WindowEntry {
  timestamps: number[];
}

const userStore = new Map<string, WindowEntry>();
const ipStore = new Map<string, WindowEntry>();

function pruneEntry(entry: WindowEntry, windowMs: number, now: number): void {
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

function pruneMap(map: Map<string, WindowEntry>, windowMs: number): void {
  const now = Date.now();
  for (const [key, entry] of map.entries()) {
    pruneEntry(entry, windowMs, now);
    if (entry.timestamps.length === 0) map.delete(key);
  }
}

// Clean up stale entries every 5 minutes.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    pruneMap(userStore, USER_WINDOW_MS);
    pruneMap(ipStore, IP_WINDOW_MS);
  }, 5 * 60_000);
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as NodeJS.Timeout).unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest request in the window expires, present when not allowed. */
  retryAfter?: number;
}

function checkLimit(
  map: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    map.set(key, entry);
  }
  pruneEntry(entry, windowMs, now);
  if (entry.timestamps.length >= limit) {
    const oldestTs = entry.timestamps[0];
    const retryAfter = Math.ceil((oldestTs + windowMs - now) / 1000);
    return { allowed: false, retryAfter: retryAfter > 0 ? retryAfter : 1 };
  }
  entry.timestamps.push(now);
  return { allowed: true };
}

/** Per-user limit: 10 requests/minute (for authenticated users). */
export function checkRateLimit(userId: string): RateLimitResult {
  return checkLimit(userStore, userId, USER_LIMIT, USER_WINDOW_MS);
}

/** Per-IP limit: 20 requests/hour (for unauthenticated/pre-auth abuse protection). */
export function checkIpRateLimit(ip: string): RateLimitResult {
  return checkLimit(ipStore, ip, IP_LIMIT, IP_WINDOW_MS);
}
