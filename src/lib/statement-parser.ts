// Parser determinístico universal para resúmenes bancarios argentinos
// Soporta Santander, BBVA, Galicia, Mercado Pago y formato genérico sin IA (0 tokens)

export interface ParsedExpenseItem {
  id: string;
  date: string; // YYYY-MM-DD
  rawDate: string;
  title: string;
  amount: number;
  amountUsd?: number;
  installmentNumber?: number;
  totalInstallments?: number;
  category: string;
  scope: "personal" | "hogar";
  markForReview: boolean;
  selected: boolean;
  isTaxOrFee?: boolean;
  notes?: string;
}

export interface ParsedStatementResult {
  detectedBank: "Santander" | "BBVA" | "Galicia" | "Mercado Pago" | "Otro";
  detectedBrand: "VISA" | "MASTERCARD" | "AMEX" | "OTRA";
  detectedUser: "Augusto" | "Agus" | null;
  cardLastDigits: string | null;
  statementAmount: number;
  statementAmountUsd: number;
  closingDate: string | null; // YYYY-MM-DD
  dueDate: string | null;     // YYYY-MM-DD
  items: ParsedExpenseItem[];
}

const MONTH_MAP: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", set: "09", oct: "10", nov: "11", dic: "12",
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

export function autoCategorize(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("coto") || t.includes("carrefour") || t.includes("dia") || t.includes("jumbo") || t.includes("disco") || t.includes("vea") || t.includes("market") || t.includes("supermercado") || t.includes("makro") || t.includes("chango") || t.includes("vital")) {
    return "Supermercado";
  }
  if (t.includes("rappi") || t.includes("pedidosya") || t.includes("mcdonald") || t.includes("burger") || t.includes("starbucks") || t.includes("cafe") || t.includes("bar") || t.includes("pizza") || t.includes("restaurant") || t.includes("cerveceria") || t.includes("heladeria") || t.includes("atelierfuerza") || t.includes("puesto") || t.includes("rotiseria")) {
    return "Salidas & Delivery";
  }
  if (t.includes("uber") || t.includes("cabify") || t.includes("didi") || t.includes("ypf") || t.includes("shell") || t.includes("axion") || t.includes("combustible") || t.includes("estacionamiento") || t.includes("peaje") || t.includes("sube") || t.includes("jetsmart") || t.includes("flybondi") || t.includes("aerolineas")) {
    return "Transporte & Combustible";
  }
  if (t.includes("farmacity") || t.includes("farmacia") || t.includes("dr") || t.includes("laboratorio") || t.includes("medico") || t.includes("optica") || t.includes("swiss") || t.includes("osde") || t.includes("consultorio")) {
    return "Farmacia & Salud";
  }
  if (t.includes("sodimac") || t.includes("easy") || t.includes("ferreteria") || t.includes("muebles") || t.includes("bazar") || t.includes("pintureria") || t.includes("hogar") || t.includes("luquin")) {
    return "Hogar & Arreglos";
  }
  if (t.includes("edenor") || t.includes("edesur") || t.includes("metrogas") || t.includes("aysa") || t.includes("telecom") || t.includes("fibertel") || t.includes("claro") || t.includes("movistar") || t.includes("personal") || t.includes("flow") || t.includes("starlink") || t.includes("netflix") || t.includes("spotify") || t.includes("youtube") || t.includes("google") || t.includes("apple") || t.includes("paddle") || t.includes("amazon") || t.includes("openai") || t.includes("github")) {
    return "Servicios (Luz, Gas, Wifi)";
  }
  if (t.includes("impuesto") || t.includes("sellos") || t.includes("iva") || t.includes("db.rg") || t.includes("percep") || t.includes("comision")) {
    return "Tarjetas";
  }
  return "Varios";
}

// Limpia montos en formato AR: "$ 29.999,88" o "29.999,88" o "-$ 378.000,00"
export function parseArgentineAmount(raw: string): number {
  if (!raw) return 0;
  let clean = raw.trim().replace(/\$/g, "").replace(/\s+/g, "");
  const isNegative = clean.startsWith("-") || clean.includes("menos");
  clean = clean.replace(/^-/, "").replace(/^menos/i, "");
  // Reemplazar puntos de miles y coma decimal
  clean = clean.replace(/\./g, "").replace(/,/g, ".");
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

// Convierte DD/MM/YY o DD-Mes-YY a YYYY-MM-DD
export function normalizeDate(raw: string, fallbackYear?: number): string {
  const now = new Date();
  const defYear = fallbackYear || now.getFullYear();

  // Caso DD/MM/YY o DD/MM/YYYY
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    let y = slashMatch[3];
    if (y.length === 2) {
      y = parseInt(y, 10) > 70 ? `19${y}` : `20${y}`;
    }
    return `${y}-${month}-${day}`;
  }

  // Caso DD-MM-YY (ej: 22-09-26 de Galicia)
  const dashNumMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashNumMatch) {
    const day = dashNumMatch[1].padStart(2, "0");
    const month = dashNumMatch[2].padStart(2, "0");
    let y = dashNumMatch[3];
    if (y.length === 2) {
      y = parseInt(y, 10) > 70 ? `19${y}` : `20${y}`;
    }
    return `${y}-${month}-${day}`;
  }

  // Caso DD-Mes-YY (ej: 07-Abr-26 de BBVA)
  const textMonthMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3,4})-(\d{2,4})$/i);
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, "0");
    const monthStr = textMonthMatch[2].toLowerCase();
    const month = MONTH_MAP[monthStr] || "01";
    let y = textMonthMatch[3];
    if (y.length === 2) {
      y = parseInt(y, 10) > 70 ? `19${y}` : `20${y}`;
    }
    return `${y}-${month}-${day}`;
  }

  // Caso "11 de septiembre" de Mercado Pago
  const mpDateMatch = raw.match(/^(\d{1,2})\s+de\s+([a-zA-Z]+)/i);
  if (mpDateMatch) {
    const day = mpDateMatch[1].padStart(2, "0");
    const monthStr = mpDateMatch[2].toLowerCase();
    const month = MONTH_MAP[monthStr] || "01";
    return `${defYear}-${month}-${day}`;
  }

  return now.toISOString().split("T")[0];
}

export function parseStatementText(text: string): ParsedStatementResult {
  const result: ParsedStatementResult = {
    detectedBank: "Otro",
    detectedBrand: "VISA",
    detectedUser: null,
    cardLastDigits: null,
    statementAmount: 0,
    statementAmountUsd: 0,
    closingDate: null,
    dueDate: null,
    items: [],
  };

  const headerSample = text.slice(0, 3000).toLowerCase();

  // 1. Detección de Banco y Marca por Header primero
  if (headerSample.includes("santander")) {
    result.detectedBank = "Santander";
  } else if (headerSample.includes("bbva")) {
    result.detectedBank = "BBVA";
  } else if (headerSample.includes("galicia")) {
    result.detectedBank = "Galicia";
  } else if (headerSample.includes("mercado pago") || headerSample.includes("mercadopago")) {
    result.detectedBank = "Mercado Pago";
  } else if (text.toLowerCase().includes("santander")) {
    result.detectedBank = "Santander";
  } else if (text.toLowerCase().includes("bbva")) {
    result.detectedBank = "BBVA";
  } else if (text.toLowerCase().includes("galicia")) {
    result.detectedBank = "Galicia";
  } else if (text.toLowerCase().includes("merpago") || text.toLowerCase().includes("mercado pago")) {
    result.detectedBank = "Mercado Pago";
  }

  if (headerSample.includes("mastercard")) {
    result.detectedBrand = "MASTERCARD";
  } else if (headerSample.includes("amex") || headerSample.includes("american express")) {
    result.detectedBrand = "AMEX";
  } else {
    result.detectedBrand = "VISA";
  }

  // 2. Detección de Usuario
  if (headerSample.includes("august") || headerSample.includes("gronda")) {
    result.detectedUser = "Augusto";
  } else if (headerSample.includes("agustina") || headerSample.includes("agus")) {
    result.detectedUser = "Agus";
  }

  // 3. Detección de terminación de tarjeta
  const cardMatch = text.match(/(?:terminada en|tarjeta)\s+(\d{4})/i);
  if (cardMatch) {
    result.cardLastDigits = cardMatch[1];
  }

  // 4. Detección de Totales y Fechas
  if (result.detectedBank === "Galicia") {
    // En Galicia: "TOTAL A PAGAR 196.153,36 0,00"
    const galiciaTotalMatch = text.match(/TOTAL A PAGAR\s+([\d\.,]+)(?:\s+([\d\.,]+))?/i);
    if (galiciaTotalMatch) {
      result.statementAmount = parseArgentineAmount(galiciaTotalMatch[1]);
      if (galiciaTotalMatch[2]) result.statementAmountUsd = parseArgentineAmount(galiciaTotalMatch[2]);
    }
    // Galicia ciclo: 20-Ago-26 01-Sep-26 24-Sep-26 05-Oct-26
    const galiciaCycle = text.match(/(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{2})/i);
    if (galiciaCycle) {
      result.closingDate = normalizeDate(galiciaCycle[3]);
      result.dueDate = normalizeDate(galiciaCycle[4]);
    }
  } else if (result.detectedBank === "BBVA") {
    // BBVA: CIERRE ACTUAL 01-Oct-26 VENCIMIENTO ACTUAL 09-Oct-26 SALDO ACTUAL $ 722.375,80 SALDO ACTUAL U$S 13,20
    const bbvaSaldoPesos = text.match(/SALDO ACTUAL\s+\$?\s*([\d\.,]+)/i);
    if (bbvaSaldoPesos) result.statementAmount = parseArgentineAmount(bbvaSaldoPesos[1]);

    const bbvaSaldoUsd = text.match(/SALDO ACTUAL U\$S\s*([\d\.,]+)/i);
    if (bbvaSaldoUsd) result.statementAmountUsd = parseArgentineAmount(bbvaSaldoUsd[1]);

    const vtoBbva = text.match(/VENCIMIENTO ACTUAL[\s\S]*?(\d{2}-[A-Za-z]{3}-\d{2})/i);
    if (vtoBbva) result.dueDate = normalizeDate(vtoBbva[1]);

    const cierreBbva = text.match(/CIERRE ACTUAL[\s\S]*?(\d{2}-[A-Za-z]{3}-\d{2})/i);
    if (cierreBbva) result.closingDate = normalizeDate(cierreBbva[1]);
  } else {
    // Santander u otro
    const totalPesosMatch = 
      text.match(/Total a pagar[\s\S]*?En pesos[\s\S]*?\$?\s*([\d\.,]+)/i) ||
      text.match(/Total a pagar[\s\S]*?\$?\s*([\d\.,]+)/i) ||
      text.match(/SALDO ACTUAL\s+\$?\s*([\d\.,]+)/i);

    if (totalPesosMatch) {
      result.statementAmount = parseArgentineAmount(totalPesosMatch[1]);
    }

    const totalUsdMatch = 
      text.match(/En d[oó]lares[\s\S]*?U\$S\s*([\d\.,]+)/i) ||
      text.match(/Total en d[oó]lares[\s\S]*?([\d\.,]+)/i);

    if (totalUsdMatch) {
      result.statementAmountUsd = parseArgentineAmount(totalUsdMatch[1]);
    }

    const vtoSantander = text.match(/Vencimiento\s*actual\s*(\d{2}\/\d{2}\/\d{2})/i);
    if (vtoSantander) result.dueDate = normalizeDate(vtoSantander[1]);

    const cierreSantander = text.match(/Cierre\s*actual\s*(\d{2}\/\d{2}\/\d{2})/i);
    if (cierreSantander) result.closingDate = normalizeDate(cierreSantander[1]);
  }

  // 5. Parseo de consumos línea por línea
  const lines = text.split("\n");
  let lastSeenDate: string = result.closingDate || new Date().toISOString().split("T")[0];
  let inMovementsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const lineLower = line.toLowerCase();

    // Detección de parada para no leer términos y condiciones
    if (
      lineLower.includes("plan v:") ||
      lineLower.includes("términos y condiciones") ||
      lineLower.includes("terminos y condiciones") ||
      lineLower.includes("tna:tasa nominal anual") ||
      lineLower.includes("sujeto al límite disponible") ||
      lineLower.includes("costo financiero total") ||
      lineLower.includes("debitaremos de su cta") ||
      lineLower.includes("las nuevas comisiones vigentes")
    ) {
      // Fin de la sección de movimientos
      if (inMovementsSection && result.items.length > 0) {
        break;
      }
    }

    // En Santander: los consumos reales empiezan en "Movimientos de Luis August..."
    if (lineLower.includes("movimientos de") || lineLower.includes("visa crédito terminada en") || lineLower.includes("visa credito terminada en")) {
      inMovementsSection = true;
      continue;
    }

    // En Galicia: "detalle del consumo"
    if (lineLower.includes("detalle del consumo")) {
      inMovementsSection = true;
      continue;
    }

    // En BBVA: "consumos "
    if (lineLower.includes("consumos luis augusto") || lineLower.includes("consumos ")) {
      inMovementsSection = true;
      continue;
    }

    // En Mercado Pago: "movimientos"
    if (lineLower.includes("movimientos") && !lineLower.includes("de luis")) {
      inMovementsSection = true;
      continue;
    }

    // Si aún no entramos a movimientos y no es un texto pegado directo, ignorar
    if (!inMovementsSection && result.detectedBank !== "Otro") {
      continue;
    }

    // Saltar líneas de pagos anteriores o totales intermedios
    if (
      lineLower.includes("saldo anterior") ||
      lineLower.includes("su pago en") ||
      lineLower.includes("anulacion de pago") ||
      lineLower.includes("subtotal de") ||
      lineLower.includes("total consumos de") ||
      lineLower.includes("total a pagar") ||
      lineLower.includes("pago anterior y devoluciones")
    ) {
      continue;
    }

    // --- CASO 1: Formato Santander / Galicia ---
    // Ej: "09/03/26 Gmra - samsung.com 8 de 9 002679 29.999,88"
    // Ej: "22-09-26 * WWW.JETSMART.COM 000782 196.744,38"
    // Ej: "17/09/26 Payu*ar*uber 004865 $ 12.721,00"
    // Ej: "Google *youtubep p1ov3x9s 478208 U$S 6,88" (sin fecha)
    const santanderRegex = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})?\s+(.*?)(?:\s+(\d{1,2})\s+de\s+(\d{1,2}))?\s+(\d{6})\s+([-\$]?\s*[\d\.,]+(?:\s*(?:pesos|d[oó]lares))?)/i;
    const matchSantander = line.match(santanderRegex);

    if (matchSantander) {
      const rawDate = matchSantander[1];
      const titleRaw = matchSantander[2].trim();
      const cuotaActual = matchSantander[3] ? parseInt(matchSantander[3], 10) : undefined;
      const cuotasTotal = matchSantander[4] ? parseInt(matchSantander[4], 10) : undefined;
      const rawAmount = matchSantander[6];

      if (rawDate) {
        lastSeenDate = normalizeDate(rawDate);
      }

      const isUsd = lineLower.includes("u$s") || lineLower.includes("dólares") || lineLower.includes("dolares");
      const amountVal = parseArgentineAmount(rawAmount);

      if (titleRaw && Math.abs(amountVal) > 0) {
        const isTax = titleRaw.toLowerCase().includes("impuesto") || titleRaw.toLowerCase().includes("iva rg") || titleRaw.toLowerCase().includes("db.rg") || titleRaw.toLowerCase().includes("sellos");
        result.items.push({
          id: `item-${result.items.length + 1}`,
          date: lastSeenDate,
          rawDate: rawDate || lastSeenDate,
          title: cleanMerchantTitle(titleRaw),
          amount: isUsd ? 0 : amountVal,
          amountUsd: isUsd ? amountVal : undefined,
          installmentNumber: cuotaActual,
          totalInstallments: cuotasTotal,
          category: autoCategorize(titleRaw),
          scope: "personal",
          markForReview: true,
          selected: amountVal > 0 && !isTax,
          isTaxOrFee: isTax,
          notes: cuotaActual && cuotasTotal ? `Cuota ${cuotaActual}/${cuotasTotal}` : undefined,
        });
        continue;
      }
    }

    // --- CASO 2: Formato BBVA ---
    // Ej: "07-Abr-26 FERBI.COM C.06/12 005992 44.166,66"
    // Ej: "05-Sep-26 Spotify USD 1,20 985122 1,20"
    const bbvaRegex = /^(\d{2}-[A-Za-z]{3}-\d{2,4})\s+(.*?)(?:\s+C\.(\d{2})\/(\d{2}))?\s+(\d{6})\s+([\d\.,]+)(?:\s+([\d\.,]+))?/i;
    const matchBbva = line.match(bbvaRegex);

    if (matchBbva) {
      const rawDate = matchBbva[1];
      const titleRaw = matchBbva[2].trim();
      const cuotaActual = matchBbva[3] ? parseInt(matchBbva[3], 10) : undefined;
      const cuotasTotal = matchBbva[4] ? parseInt(matchBbva[4], 10) : undefined;
      const amount1 = parseArgentineAmount(matchBbva[6]);
      const amount2 = matchBbva[7] ? parseArgentineAmount(matchBbva[7]) : undefined;

      const dateNorm = normalizeDate(rawDate);
      lastSeenDate = dateNorm;

      const isUsd = titleRaw.toLowerCase().includes("usd") || amount2 !== undefined;
      const pesosAmount = isUsd && amount2 !== undefined ? amount1 : (isUsd ? 0 : amount1);
      const usdAmount = isUsd ? (amount2 || amount1) : undefined;

      result.items.push({
        id: `item-${result.items.length + 1}`,
        date: dateNorm,
        rawDate,
        title: cleanMerchantTitle(titleRaw),
        amount: pesosAmount,
        amountUsd: usdAmount,
        installmentNumber: cuotaActual,
        totalInstallments: cuotasTotal,
        category: autoCategorize(titleRaw),
        scope: "personal",
        markForReview: true,
        selected: true,
        notes: cuotaActual && cuotasTotal ? `Cuota ${cuotaActual}/${cuotasTotal}` : undefined,
      });
      continue;
    }

    // --- CASO 3: Formato Mercado Pago ---
    const mpDateMatch = line.match(/^(\d{1,2}\s+de\s+[A-Za-z]+)/i);
    if (mpDateMatch) {
      lastSeenDate = normalizeDate(mpDateMatch[1]);
      continue;
    }

    const mpConsumoMatch = line.match(/^(.*?)\s*[-–]?\s*\$\s*([\d\.,]+)/i);
    if (mpConsumoMatch) {
      const titleRaw = mpConsumoMatch[1].trim();
      const amountVal = parseArgentineAmount(mpConsumoMatch[2]);

      let cuotaActual: number | undefined;
      let cuotasTotal: number | undefined;
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const cuotaMatch = nextLine.match(/cuota\s+(\d{1,2})\s+de\s+(\d{1,2})/i);
        if (cuotaMatch) {
          cuotaActual = parseInt(cuotaMatch[1], 10);
          cuotasTotal = parseInt(cuotaMatch[2], 10);
        }
      }

      if (titleRaw && amountVal > 0 && !titleRaw.toLowerCase().includes("total")) {
        result.items.push({
          id: `item-${result.items.length + 1}`,
          date: lastSeenDate,
          rawDate: lastSeenDate,
          title: cleanMerchantTitle(titleRaw),
          amount: amountVal,
          installmentNumber: cuotaActual,
          totalInstallments: cuotasTotal,
          category: autoCategorize(titleRaw),
          scope: "personal",
          markForReview: true,
          selected: true,
          notes: cuotaActual && cuotasTotal ? `Cuota ${cuotaActual}/${cuotasTotal}` : undefined,
        });
        continue;
      }
    }
  }

  return result;
}

function cleanMerchantTitle(raw: string): string {
  let clean = raw.trim();
  clean = clean.replace(/^\*\s*/, "");
  clean = clean.replace(/^payu\*ar\*/i, "");
  clean = clean.replace(/^dlo\*/i, "");
  clean = clean.replace(/^merpago\*/i, "");
  clean = clean.replace(/^c\.\d{2}\/\d{2}/i, "");
  clean = clean.replace(/\s+usd\s+[\d\.,]+/i, "");
  clean = clean.replace(/\s+s\.a\.?$/i, "");
  clean = clean.replace(/\s+s\.r\.l\.?$/i, "");
  clean = clean.trim();
  if (clean === clean.toUpperCase() && clean.length > 3) {
    clean = clean.charAt(0) + clean.slice(1).toLowerCase();
  }
  return clean;
}
