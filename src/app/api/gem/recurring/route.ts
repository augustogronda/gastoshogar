import { NextResponse } from "next/server";
import { validateGemAuth, createGemRecurring } from "@/lib/gem-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!validateGemAuth(req)) {
    return NextResponse.json(
      { error: "No autorizado. Clave de API de Gemini incorrecta o faltante." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const result = await createGemRecurring(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Error in POST /api/gem/recurring:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al registrar gasto recurrente o cuota" },
      { status: 400 }
    );
  }
}
