import { PrismaClient } from "@prisma/client";

function getDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || "";
  if (!url) return url;

  // Si usa el pooler de Supabase en puerto 5432 (modo sesión), cambiarlo a 6543 (modo transacción)
  if (url.includes("pooler.supabase.com:5432")) {
    url = url.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543");
  }

  // Asegurar flags de PgBouncer para evitar el error de prepared statement "s0" already exists (42P05)
  if (!url.includes("pgbouncer=true")) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}pgbouncer=true&connection_limit=1`;
  }

  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: getDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Guardar en globalThis tanto en desarrollo como en producción (Serverless / Vercel)
// para evitar que cada server action o revalidación instancie un nuevo cliente y choque conexiones.
globalForPrisma.prisma = prisma;
