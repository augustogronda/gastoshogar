import { PrismaClient } from "@prisma/client";

function getDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || "";
  if (!url) return url;

  // Si usa el pooler de Supabase en puerto 5432 (modo sesión), cambiarlo a 6543 (modo transacción)
  if (url.includes("pooler.supabase.com:5432")) {
    url = url.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543");
  }

  // Limpiar cualquier flag restrictivo previo (connection_limit=1 o timeouts viejos)
  url = url.replace(/([?&])connection_limit=\d+/g, "");
  url = url.replace(/([?&])pool_timeout=\d+/g, "");
  url = url.replace(/([?&])pgbouncer=(true|false)/g, "");

  // Asegurar flags óptimos para Supabase PgBouncer en Serverless:
  // - pgbouncer=true: evita error 42P05 de prepared statement
  // - connection_limit=10: permite que los Promise.all concurrentes de getDashboardData se ejecuten en paralelo sin saturar el pool interno
  // - pool_timeout=30: tolerancia de 30s para adquirir conexión en picos de latencia
  const sep = url.includes("?") ? "&" : "?";
  url = `${url}${sep}pgbouncer=true&connection_limit=10&pool_timeout=30`;

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
