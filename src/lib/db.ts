import { PrismaClient } from "@prisma/client";
import { mockDb } from "./mock-db";

// In this container environment, external TCP database connections are disabled.
// mockDb provides a comprehensive in-memory database populated with full seed data
// (103 communities, lookups, demo accounts, sessions, and narratives).
export const db: PrismaClient = mockDb as unknown as PrismaClient;

