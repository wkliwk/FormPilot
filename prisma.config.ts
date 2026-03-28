import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, ".env") });
config({ path: resolve(__dirname, ".env.local"), override: true });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
