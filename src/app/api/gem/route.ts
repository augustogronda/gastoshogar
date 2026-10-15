import { NextResponse } from "next/server";
import { getGemApiKey } from "@/lib/gem-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;

  return NextResponse.json({
    name: "Gastos Hogar & Finanzas API para Gemini Gem",
    status: "active",
    openApiSpecUrl: `${baseUrl}/api/gem/openapi`,
    instructions: "Para configurar tu Custom Gem en Gemini, importá la especificación OpenAPI desde openApiSpecUrl y configurá el header de autenticación 'x-api-key' con tu clave de API.",
    endpoints: [
      { method: "GET", path: "/api/gem/status", description: "Estado financiero general (60% hogar, 40% personal, balances y tarjetas)" },
      { method: "GET", path: "/api/gem/expenses", description: "Búsqueda y consulta de gastos" },
      { method: "POST", path: "/api/gem/expenses", description: "Registrar gasto desde comprobante bancario o texto" },
      { method: "POST", path: "/api/gem/recurring", description: "Crear plan de cuotas o gasto recurrente" },
      { method: "POST", path: "/api/gem/cards/statement", description: "Actualizar resumen o pago de tarjeta de crédito" },
    ],
  });
}
