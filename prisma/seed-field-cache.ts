import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface FieldCacheEntry {
  cacheKey: string;
  explanation: string;
  example: string;
  commonMistakes: string;
  whereToFind?: string;
  profileKey?: string;
}

async function main() {
  const dataPath = path.join(__dirname, "data", "field-cache-seed.json");
  const entries: FieldCacheEntry[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  let upserted = 0;
  for (const entry of entries) {
    await prisma.fieldCache.upsert({
      where: { cacheKey: entry.cacheKey },
      update: {
        explanation: entry.explanation,
        example: entry.example,
        commonMistakes: entry.commonMistakes,
        whereToFind: entry.whereToFind ?? null,
        profileKey: entry.profileKey ?? null,
        expiresAt,
      },
      create: {
        cacheKey: entry.cacheKey,
        explanation: entry.explanation,
        example: entry.example,
        commonMistakes: entry.commonMistakes,
        whereToFind: entry.whereToFind ?? null,
        profileKey: entry.profileKey ?? null,
        expiresAt,
      },
    });
    upserted++;
  }

  console.log(`Field cache seed complete — ${upserted} entries upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
