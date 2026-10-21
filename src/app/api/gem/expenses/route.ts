import { NextResponse } from "next/server";
import {
  validateGemAuth,
  queryGemExpenses,
  createGemExpense,
  createGemExpensesBatch,
} from "@/lib/gem-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!validateGemAuth(req)) {
    return NextResponse.json(
      { error: "No autorizado. Clave de API de Gemini incorrecta o faltante." },
      { status: 401 }
    );
  }

  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") as any) || "all";
    const year = url.searchParams.get("year") ? parseInt(url.searchParams.get("year")!) : undefined;
    const month = url.searchParams.get("month") ? parseInt(url.searchParams.get("month")!) : undefined;
    const user = url.searchParams.get("user") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : undefined;

    const data = await queryGemExpenses({
      scope,
      year,
      month,
      user,
      category,
      search,
      limit,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error in GET /api/gem/expenses:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al consultar gastos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!validateGemAuth(req)) {
    return NextResponse.json(
      { error: "No autorizado. Clave de API de Gemini incorrecta o faltante." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    // Si viene un array o un objeto con propiedad 'expenses', procesar como lote
    if (Array.isArray(body)) {
      const result = await createGemExpensesBatch({ expenses: body });
      return NextResponse.json(result);
    }

    if (body && Array.isArray(body.expenses)) {
      const result = await createGemExpensesBatch(body);
      return NextResponse.json(result);
    }

    const result = await createGemExpense(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Error in POST /api/gem/expenses:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al registrar gasto" },
      { status: 400 }
    );
  }
}
