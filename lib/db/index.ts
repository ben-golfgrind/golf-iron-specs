// Prisma client singleton.
//
// Next.js dev mode (HMR) re-evaluates server modules on every change, which
// would otherwise spin up a fresh PrismaClient per change and exhaust DB
// connections. The standard pattern is to cache the client on globalThis in
// non-production so HMR reuses it.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
