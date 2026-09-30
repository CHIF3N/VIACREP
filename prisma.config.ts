import path from "node:path";
import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

// When prisma.config.ts is present, Prisma skips automatic .env loading.
// Load it explicitly so DATABASE_URL is available for `db push`, `generate`, etc.
dotenv.config({ path: path.resolve(__dirname, ".env") });

/**
 * Prisma configuration file (Prisma 7 forward-compatible).
 * Suppresses the "package.json#prisma is deprecated" warning.
 * See: https://pris.ly/prisma-config
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
});