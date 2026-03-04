import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const fallbackDatabaseUrl = process.env.DATABASE_URL?.trim()
  || (process.env.VERCEL
    ? "file:/tmp/sekou-manual-editor.db"
    : "file:./dev.db");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: fallbackDatabaseUrl,
      },
    },
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
