import { NextResponse } from "next/server";
import { validateGemAuth, updateGemCardStatement } from "@/lib/gem-service";

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
    const result = await updateGemCardStatement(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Error in POST /api/gem/cards/statement:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar resumen de tarjeta" },
      { status: 400 }
    );
  }
}
