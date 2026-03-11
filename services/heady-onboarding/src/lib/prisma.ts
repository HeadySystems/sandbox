// Fully lazy prisma client — no top-level import so the build never
// needs the generated .prisma/client module at compile time.
type PrismaClientType = import("@prisma/client").PrismaClient;

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClientType | undefined;
};

function getPrismaClient(): PrismaClientType {
  if (!globalForPrisma.__prisma) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
    globalForPrisma.__prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.__prisma;
}

// Proxy defers everything — including the require() — until first property access
export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop) {
    return (getPrismaClient() as any)[prop];
  },
});
