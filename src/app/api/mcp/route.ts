import { NextResponse } from "next/server";
import { handleMcpRpcRequest } from "@/lib/mcp-server";
import { validateGemAuth } from "@/lib/gem-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, mcp-session-id",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// GET: Maneja la conexión SSE (Server-Sent Events) del estándar MCP o status descriptivo
export async function GET(req: Request) {
  if (!validateGemAuth(req)) {
    return NextResponse.json(
      {
        error: "No autorizado. Se requiere token secreto (ej: ?key=tu_clave o header x-api-key).",
      },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const url = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;
  const acceptHeader = req.headers.get("accept") || "";

  // Preservar la clave de autenticación para que el cliente la use en sus POST subsiguientes
  const key = url.searchParams.get("key") || url.searchParams.get("token") || "";
  const keyParam = key ? `&key=${encodeURIComponent(key)}` : "";

  // Si el cliente pide SSE (flujo estándar de MCP)
  if (acceptHeader.includes("text/event-stream")) {
    const sessionId = url.searchParams.get("sessionId") || crypto.randomUUID();
    const messageEndpoint = `${baseUrl}/api/mcp?sessionId=${sessionId}${keyParam}`;

    let timer: NodeJS.Timeout | null = null;
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        // Evento 'endpoint' según especificación MCP SSE transport
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${messageEndpoint}\n\n`));

        // Heartbeat para mantener viva la conexión sin que Vercel la considere colgada
        timer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            if (timer) clearInterval(timer);
          }
        }, 15000);

        // Si el cliente cierra la conexión o cancela la petición, cerrar el stream limpiamente
        req.signal.addEventListener("abort", () => {
          if (timer) clearInterval(timer);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        if (timer) clearInterval(timer);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        ...CORS_HEADERS,
      },
    });
  }

  // Si es un GET estándar desde navegador o ping
  return NextResponse.json(
    {
      name: "Gastos Hogar MCP Server",
      protocolVersion: "2024-11-05",
      status: "ready",
      authenticated: true,
      availableTools: [
        "get_financial_status",
        "query_expenses",
        "create_expense",
        "create_recurring_expense",
        "update_card_statement",
      ],
    },
    { headers: CORS_HEADERS }
  );
}

// POST: Maneja las solicitudes JSON-RPC 2.0 de MCP
export async function POST(req: Request) {
  if (!validateGemAuth(req)) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "No autorizado. Se requiere token secreto (ej: ?key=tu_clave o header x-api-key).",
        },
      },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await req.json();

    // Soporte para batch de JSON-RPC o request único
    if (Array.isArray(body)) {
      const responses = await Promise.all(body.map((r) => handleMcpRpcRequest(r)));
      const filtered = responses.filter(Boolean);
      return NextResponse.json(filtered, { headers: CORS_HEADERS });
    }

    const response = await handleMcpRpcRequest(body);
    if (!response) {
      // Notificación sin id
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    console.error("Error en MCP POST:", err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error o JSON inválido",
          data: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
