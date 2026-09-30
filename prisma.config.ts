import { defineConfig } from "prisma/config";

/**
 * Prisma configuration file (Prisma 7 forward-compatible).
 * Suppresses the "package.json#prisma is deprecated" warning.
 * See: https://pris.ly/prisma-config
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
});