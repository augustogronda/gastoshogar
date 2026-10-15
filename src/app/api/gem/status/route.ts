import { NextResponse } from "next/server";
import { validateGemAuth, getGemFinancialStatus } from "@/lib/gem-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!validateGemAuth(req)) {
    return NextResponse.json(
      { error: "No autorizado. Clave de API de Gemini incorrecta o faltante (usar header x-api-key o Authorization: Bearer <token>)." },
      { status: 401 }
    );
  }

  try {
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year") ? parseInt(url.searchParams.get("year")!) : undefined;
    const monthParam = url.searchParams.get("month") ? parseInt(url.searchParams.get("month")!) : undefined;

    const data = await getGemFinancialStatus(yearParam, monthParam);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error in /api/gem/status:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener estado financiero" },
      { status: 500 }
    );
  }
}
