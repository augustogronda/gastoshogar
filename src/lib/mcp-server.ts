import {
  getGemFinancialStatus,
  queryGemExpenses,
  createGemExpense,
  createGemRecurring,
  updateGemCardStatement,
} from "./gem-service";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export const MCP_TOOLS = [
  {
    name: "get_financial_status",
    description:
      "Obtiene el estado financiero completo del hogar y de cada usuario: presupuesto del 60% (gastado, remanente, balances de bolsillo entre Augusto y Agus), presupuestos personales del 40%, resúmenes y fechas de vencimiento de tarjetas de crédito (Galicia, Santander, BBVA, Mercado Pago) y remanente FCI.",
    inputSchema: {
      type: "object",
      properties: {
        year: {
          type: "integer",
          description: "Año (ej: 2026). Por defecto el actual.",
        },
        month: {
          type: "integer",
          description: "Mes (1 al 12). Por defecto el actual.",
        },
      },
    },
  },
  {
    name: "query_expenses",
    description:
      "Busca y consulta la lista de gastos registrados en el mes con filtros por ámbito (hogar o personal), pagador (Augusto o Agus), categoría o búsqueda por texto de comercio/concepto.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["hogar", "personal", "all"],
          description: "'hogar' (fondo común 60%), 'personal' o 'all'.",
        },
        user: {
          type: "string",
          description: "'Augusto' o 'Agus'.",
        },
        category: {
          type: "string",
          description: "Categoría (ej: Supermercado, Farmacia, etc.).",
        },
        search: {
          type: "string",
          description: "Texto a buscar en el título o comercio (ej: 'Coto', 'YPF').",
        },
        year: { type: "integer" },
        month: { type: "integer" },
        limit: { type: "integer", default: 50 },
      },
    },
  },
  {
    name: "create_expense",
    description:
      "Registra un nuevo gasto en la app (ideal para procesar capturas de pantalla de bancos, transferencias o dictados por voz). Extrae comercio, monto, fecha, categoría y pagador.",
    inputSchema: {
      type: "object",
      required: ["title", "amount"],
      properties: {
        title: {
          type: "string",
          description: "Nombre del comercio o concepto (ej: 'Coto', 'Farmacity', 'Shell').",
        },
        amount: {
          type: "number",
          description: "Monto total en pesos ARS.",
        },
        scope: {
          type: "string",
          enum: ["hogar", "personal"],
          default: "hogar",
          description: "'hogar' para gasto compartido del 60% o 'personal' para gasto privado.",
        },
        user: {
          type: "string",
          description: "Quién pagó: 'Augusto' o 'Agus'.",
        },
        category: {
          type: "string",
          description:
            "Categoría aproximada ('Supermercado', 'Salidas & Delivery', 'Transporte & Combustible', 'Farmacia & Salud', 'Alquiler & Expensas', 'Servicios', 'Hogar & Arreglos', 'Varios').",
        },
        date: {
          type: "string",
          description: "Fecha del comprobante en formato YYYY-MM-DD (por defecto hoy).",
        },
        notes: {
          type: "string",
          description: "Detalle, número de comprobante o nota adicional.",
        },
        installmentNumber: {
          type: "integer",
          description: "Número de cuota si aplica (ej: 1).",
        },
        totalInstallments: {
          type: "integer",
          description: "Total de cuotas si aplica (ej: 3 o 6).",
        },
      },
    },
  },
  {
    name: "create_recurring_expense",
    description:
      "Crea un gasto mensual recurrente fijo (ej: Netflix, Spotify) o un plan de cuotas fijas de tarjeta.",
    inputSchema: {
      type: "object",
      required: ["title", "installmentAmount"],
      properties: {
        title: { type: "string" },
        installmentAmount: {
          type: "number",
          description: "Monto mensual de la cuota o servicio.",
        },
        totalInstallments: {
          type: "integer",
          description: "Cantidad de cuotas (dejar vacío si es recurrente fijo).",
        },
        scope: {
          type: "string",
          enum: ["hogar", "personal"],
          default: "hogar",
        },
        user: {
          type: "string",
          description: "'Augusto' o 'Agus'.",
        },
        category: { type: "string" },
        creditCardName: {
          type: "string",
          description: "Opcional: nombre de la tarjeta ('Galicia Visa', 'Santander', 'Mercado Pago').",
        },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "update_card_statement",
    description:
      "Actualiza el resumen mensual de una tarjeta de crédito o la marca como pagada.",
    inputSchema: {
      type: "object",
      required: ["bank", "brand"],
      properties: {
        user: {
          type: "string",
          description: "'Augusto' o 'Agus'.",
        },
        bank: {
          type: "string",
          description: "Banco ('Santander', 'Galicia', 'BBVA', 'Mercado Pago').",
        },
        brand: {
          type: "string",
          description: "'VISA', 'AMEX', 'MASTERCARD'.",
        },
        statementAmount: {
          type: "number",
          description: "Monto total del resumen en pesos ARS.",
        },
        statementAmountUsd: {
          type: "number",
          description: "Monto en dólares si aplica.",
        },
        isPaid: {
          type: "boolean",
          description: "True si el resumen ya fue pagado.",
        },
        dueDate: {
          type: "string",
          description: "Fecha de vencimiento YYYY-MM-DD.",
        },
        closingDate: {
          type: "string",
          description: "Fecha de cierre YYYY-MM-DD.",
        },
      },
    },
  },
];

export async function handleMcpRpcRequest(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const { id, method, params } = req;

  // 1. initialize
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "gastoshogar-mcp",
          version: "1.0.0",
        },
      },
    };
  }

  // 2. notifications/initialized (notification -> no response needed if no id)
  if (method === "notifications/initialized") {
    if (id === undefined || id === null) return null;
    return { jsonrpc: "2.0", id, result: {} };
  }

  // 3. ping
  if (method === "ping") {
    return { jsonrpc: "2.0", id: id ?? null, result: {} };
  }

  // 4. tools/list
  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  // 5. tools/call
  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    try {
      let callResult: any = null;

      if (toolName === "get_financial_status") {
        callResult = await getGemFinancialStatus(args.year, args.month);
      } else if (toolName === "query_expenses") {
        callResult = await queryGemExpenses(args);
      } else if (toolName === "create_expense") {
        callResult = await createGemExpense(args);
      } else if (toolName === "create_recurring_expense") {
        callResult = await createGemRecurring(args);
      } else if (toolName === "update_card_statement") {
        callResult = await updateGemCardStatement(args);
      } else {
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          error: {
            code: -32601,
            message: `Herramienta desconocida: ${toolName}`,
          },
        };
      }

      return {
        jsonrpc: "2.0",
        id: id ?? null,
        result: {
          content: [
            {
              type: "text",
              text: typeof callResult === "string" ? callResult : JSON.stringify(callResult, null, 2),
            },
          ],
        },
      };
    } catch (err: unknown) {
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error al ejecutar ${toolName}: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code: -32601,
      message: `Método RPC no soportado: ${method}`,
    },
  };
}
