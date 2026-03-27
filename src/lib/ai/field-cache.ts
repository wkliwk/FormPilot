import { prisma } from "@/lib/prisma";

const CACHE_TTL_DAYS = 30;

/** Cached explanation data for a single field. */
export interface CachedFieldData {
  explanation: string;
  example: string;
  commonMistakes: string;
  profileKey: string | null;
}

/**
 * Normalize a field label into a stable cache key component.
 * e.g. "First Name " -> "first_name", "Date of Birth" -> "date_of_birth"
 */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Build the cache key from a field label, type, and optional language.
 * English (or no language) uses the base key: "first_name:text"
 * Non-English appends the language code: "first_name:text:es"
 */
export function buildCacheKey(label: string, type: string, language?: string | null): string {
  const base = `${normalizeLabel(label)}:${type.toLowerCase().trim()}`;
  if (!language || language === "en") return base;
  return `${base}:${language.toLowerCase().trim()}`;
}

/**
 * Look up multiple fields in the cache in a single DB query.
 * Returns a map of cacheKey -> CachedFieldData for entries that exist and have not expired.
 */
export async function lookupCacheEntries(
  cacheKeys: string[]
): Promise<Map<string, CachedFieldData>> {
  if (cacheKeys.length === 0) return new Map();

  const now = new Date();
  const rows = await prisma.fieldCache.findMany({
    where: {
      cacheKey: { in: cacheKeys },
      expiresAt: { gt: now },
    },
    select: {
      cacheKey: true,
      explanation: true,
      example: true,
      commonMistakes: true,
      profileKey: true,
    },
  });

  // Increment hit counts in background — don't block the response
  if (rows.length > 0) {
    const hitKeys = rows.map((r) => r.cacheKey);
    prisma.fieldCache
      .updateMany({
        where: { cacheKey: { in: hitKeys } },
        data: { hitCount: { increment: 1 } },
      })
      .catch((err: unknown) => {
        console.error("[field-cache] Failed to increment hit counts:", err);
      });
  }

  const result = new Map<string, CachedFieldData>();
  for (const row of rows) {
    result.set(row.cacheKey, {
      explanation: row.explanation,
      example: row.example,
      commonMistakes: row.commonMistakes,
      profileKey: row.profileKey,
    });
  }
  return result;
}

/**
 * Store multiple field explanations in the cache.
 * Uses upsert so re-runs don't create duplicates.
 */
export async function storeCacheEntries(
  entries: Array<{ cacheKey: string; data: CachedFieldData }>
): Promise<void> {
  if (entries.length === 0) return;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  // Run upserts concurrently
  await Promise.all(
    entries.map(({ cacheKey, data }) =>
      prisma.fieldCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          explanation: data.explanation,
          example: data.example,
          commonMistakes: data.commonMistakes,
          profileKey: data.profileKey,
          expiresAt,
        },
        update: {
          explanation: data.explanation,
          example: data.example,
          commonMistakes: data.commonMistakes,
          profileKey: data.profileKey,
          expiresAt,
        },
      })
    )
  );
}
