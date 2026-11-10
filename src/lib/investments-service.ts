// Servicio de Cotizaciones de Mercado e Inversiones
// Soporta Yahoo Finance (CEDEARs .BA, Acciones, Índices, Crypto) y DolarApi (MEP / CCL)

export interface MarketQuote {
  ticker: string;
  name: string;
  price: number;
  currency: "ARS" | "USD";
  changePercent?: number;
  change?: number;
  previousClose?: number;
  lastUpdated: string;
}

export interface ExchangeRates {
  mep: number;
  ccl: number;
  blue: number;
  oficial: number;
  updatedAt: string;
}

export interface CafciFundQuote {
  ticker: string;
  name: string;
  broker: string;
  category: string;
  currency: "ARS" | "USD";
  vcpUnit: number; // Valor de 1 cuotaparte (vcp / 1000)
  vcpPer1000: number; // Valor cada 1.000 cuotapartes (informado por CAFCI)
  date: string;
  patrimonio?: number;
}

// Caché en memoria para evitar llamadas redundantes repetidas
let cachedRates: { rates: ExchangeRates; timestamp: number } | null = null;
let cachedCafciCatalog: { funds: CafciFundQuote[]; timestamp: number } | null = null;
const quoteCache = new Map<string, { quote: MarketQuote; timestamp: number }>();

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const CAFCI_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

export const POPULAR_ARGENTINA_FCIS = [
  {
    ticker: "FCI-FIMA-PREM",
    name: "Fima Premium (Money Market)",
    broker: "Banco Galicia",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-FIMA-AHORRO",
    name: "Fima Ahorro Plus (Renta Fija)",
    broker: "Banco Galicia",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-BALANZ-MM",
    name: "Balanz Capital Money Market",
    broker: "Balanz",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-BALANZ-PERF",
    name: "Balanz Performance (Renta Fija)",
    broker: "Balanz",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-COCOS-DARUMA",
    name: "Cocos Daruma Renta Mixta",
    broker: "Cocos Capital",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-SANTANDER-SA",
    name: "Super Ahorro $ (Money Market)",
    broker: "Santander",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-BBVA-FBA",
    name: "FBA Renta Pesos",
    broker: "BBVA",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-MP-BIND",
    name: "Mercado Fondo (Bind)",
    broker: "Mercado Pago",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-IOL-PREMIER",
    name: "Premier Renta CP en Pesos",
    broker: "InvertirOnline (IOL)",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-IOL-USD",
    name: "IOL Dólar Ahorro Plus",
    broker: "InvertirOnline (IOL)",
    assetType: "FCI",
    defaultCurrency: "USD",
  },
  {
    ticker: "FCI-DELTA-PESOS",
    name: "Delta Pesos (Personal Pay)",
    broker: "Delta / Personal Pay",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-UALA",
    name: "Ualá / Uilo FCI Ahorro",
    broker: "Ualá",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-PIONERO",
    name: "Pionero Pesos",
    broker: "Banco Macro",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
  {
    ticker: "FCI-PELLEGRINI",
    name: "Pellegrini Renta Pesos",
    broker: "Banco Nación",
    assetType: "FCI",
    defaultCurrency: "ARS",
  },
];

export const POPULAR_ARGENTINA_ASSETS = [
  // CEDEARs Principales
  { ticker: "SPY.BA", name: "S&P 500 ETF (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "QQQ.BA", name: "Nasdaq 100 ETF (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "AAPL.BA", name: "Apple Inc. (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "MELI.BA", name: "MercadoLibre (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "NVDA.BA", name: "NVIDIA Corp. (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "MSFT.BA", name: "Microsoft (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "GOOGL.BA", name: "Alphabet / Google (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "AMZN.BA", name: "Amazon.com (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "META.BA", name: "Meta Platforms (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "TSLA.BA", name: "Tesla (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "KO.BA", name: "Coca-Cola (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "BRKB.BA", name: "Berkshire Hathaway (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "VIST.BA", name: "Vista Energy (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "DIA.BA", name: "Dow Jones ETF (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "EWZ.BA", name: "iShares MSCI Brazil (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },

  // Acciones Locales (Merval / BYMA)
  { ticker: "GGAL.BA", name: "Grupo Financiero Galicia", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "YPFD.BA", name: "YPF S.A.", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "PAMP.BA", name: "Pampa Energía", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "BMA.BA", name: "Banco Macro", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "TGSU2.BA", name: "Transportadora de Gas del Sur", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "CEPU.BA", name: "Central Puerto", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "TXAR.BA", name: "Ternium Argentina", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "ALUA.BA", name: "Aluar Aluminio Argentino", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "EDN.BA", name: "Edenor", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "BYMA.BA", name: "Bolsas y Mercados Argentinos", assetType: "ACCION", defaultCurrency: "ARS" },

  // Bonos y Títulos Públicos
  { ticker: "AL30.BA", name: "Bono AL30 (Bonar 2030)", assetType: "BONO", defaultCurrency: "ARS" },
  { ticker: "GD30.BA", name: "Bono GD30 (Global 2030)", assetType: "BONO", defaultCurrency: "ARS" },
  { ticker: "AL35.BA", name: "Bono AL35 (Bonar 2035)", assetType: "BONO", defaultCurrency: "ARS" },
  { ticker: "GD35.BA", name: "Bono GD35 (Global 2035)", assetType: "BONO", defaultCurrency: "ARS" },
  { ticker: "TX26.BA", name: "Boncer 2026 CER (TX26)", assetType: "BONO", defaultCurrency: "ARS" },

  // Cripto & Stablecoins
  { ticker: "BTC-USD", name: "Bitcoin (BTC)", assetType: "CRYPTO", defaultCurrency: "USD" },
  { ticker: "ETH-USD", name: "Ethereum (ETH)", assetType: "CRYPTO", defaultCurrency: "USD" },
  { ticker: "SOL-USD", name: "Solana (SOL)", assetType: "CRYPTO", defaultCurrency: "USD" },
  { ticker: "USDT-USD", name: "Tether / Dólar Cripto (USDT)", assetType: "CRYPTO", defaultCurrency: "USD" },
];

/**
 * Obtiene las cotizaciones de Dólar (MEP, CCL, Blue, Oficial)
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  if (cachedRates && now - cachedRates.timestamp < CACHE_TTL_MS) {
    return cachedRates.rates;
  }

  try {
    const res = await fetch("https://dolarapi.com/v1/dolares", {
      next: { revalidate: 180 }, // 3 minutos
      signal: AbortSignal.timeout(1800),
    });

    if (res.ok) {
      const data = await res.json();
      const mepObj = data.find((d: any) => d.casa === "bolsa" || d.nombre?.toLowerCase().includes("bolsa") || d.nombre?.toLowerCase().includes("mep"));
      const cclObj = data.find((d: any) => d.casa === "contadoconliqui");
      const blueObj = data.find((d: any) => d.casa === "blue");
      const oficialObj = data.find((d: any) => d.casa === "oficial");

      const rates: ExchangeRates = {
        mep: mepObj?.venta || mepObj?.compra || 1530,
        ccl: cclObj?.venta || cclObj?.compra || 1610,
        blue: blueObj?.venta || blueObj?.compra || 1540,
        oficial: oficialObj?.venta || oficialObj?.compra || 1500,
        updatedAt: new Date().toISOString(),
      };

      cachedRates = { rates, timestamp: now };
      return rates;
    }
  } catch (err) {
    console.error("Error fetching exchange rates from DolarApi:", err);
  }

  // Fallback seguro si la API de dólares está caída
  const fallbackRates: ExchangeRates = {
    mep: 1535,
    ccl: 1615,
    blue: 1545,
    oficial: 1520,
    updatedAt: new Date().toISOString(),
  };
  return fallbackRates;
}

/**
 * Obtiene la cotización en tiempo real de un activo mediante Yahoo Finance
 */
export async function fetchTickerQuote(ticker: string): Promise<MarketQuote | null> {
  const cleanTicker = ticker.trim().toUpperCase();
  const now = Date.now();

  const cached = quoteCache.get(cleanTicker);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.quote;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      cleanTicker
    )}?interval=1d&range=1d`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 180 },
      signal: AbortSignal.timeout(1800),
    });

    if (!res.ok) {
      console.warn(`Yahoo Finance chart returned status ${res.status} for ${cleanTicker}`);
      return null;
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;

    if (!meta || typeof meta.regularMarketPrice !== "number") {
      return null;
    }

    const currency = (meta.currency || "ARS").toUpperCase() as "ARS" | "USD";
    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || price;
    const change = price - previousClose;
    const changePercent =
      typeof meta.regularMarketChangePercent === "number"
        ? meta.regularMarketChangePercent
        : previousClose > 0
        ? (change / previousClose) * 100
        : 0;

    const name = meta.shortName || meta.longName || cleanTicker;

    const quote: MarketQuote = {
      ticker: cleanTicker,
      name,
      price,
      currency,
      changePercent,
      change,
      previousClose,
      lastUpdated: new Date().toISOString(),
    };

    quoteCache.set(cleanTicker, { quote, timestamp: now });
    return quote;
  } catch (err) {
    console.error(`Error fetching quote for ${cleanTicker}:`, err);
    return null;
  }
}

/**
 * Busca tickers coincidentes en Yahoo Finance y en la lista curada argentina
 */
export async function searchTickers(query: string) {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const results: Array<{
    ticker: string;
    name: string;
    assetType: string;
    currency: string;
    exchange?: string;
  }> = [];

  // 1. Filtrar lista curada local primero (matches exactos o parciales)
  for (const asset of POPULAR_ARGENTINA_ASSETS) {
    if (
      asset.ticker.toUpperCase().includes(q) ||
      asset.name.toUpperCase().includes(q)
    ) {
      results.push({
        ticker: asset.ticker,
        name: asset.name,
        assetType: asset.assetType,
        currency: asset.defaultCurrency,
        exchange: asset.ticker.endsWith(".BA") ? "BCBA (Argentina)" : "Global",
      });
    }
  }

  // 1b. Incluir también Fondos Comunes de Inversión (FCIs) populares
  for (const fci of POPULAR_ARGENTINA_FCIS) {
    if (
      fci.ticker.toUpperCase().includes(q) ||
      fci.name.toUpperCase().includes(q) ||
      fci.broker.toUpperCase().includes(q)
    ) {
      results.push({
        ticker: fci.ticker,
        name: `${fci.name} (${fci.broker})`,
        assetType: "FCI",
        currency: fci.defaultCurrency,
        exchange: fci.broker,
      });
    }
  }

  // 2. Si la consulta tiene al menos 2 caracteres, buscar en Yahoo Finance API
  if (q.length >= 2) {
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        query
      )}&quotesCount=8`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        const data = await res.json();
        const quotes = data?.quotes || [];

        for (const item of quotes) {
          const sym = item.symbol;
          if (!sym) continue;

          // Si ya lo tenemos en los resultados, saltear
          if (results.some((r) => r.ticker === sym)) continue;

          let type = "ACCION";
          if (sym.endsWith(".BA")) {
            type = "CEDEAR";
          } else if (item.quoteType === "CRYPTOCURRENCY" || sym.includes("-USD")) {
            type = "CRYPTO";
          } else if (item.quoteType === "ETF") {
            type = "CEDEAR";
          }

          results.push({
            ticker: sym,
            name: item.shortname || item.longname || sym,
            assetType: type,
            currency: sym.endsWith(".BA") ? "ARS" : "USD",
            exchange: item.exchDisp || item.exchange || "Mercado",
          });
        }
      }
    } catch (err) {
      console.warn("Error calling Yahoo Finance search endpoint:", err);
    }
  }

  return results.slice(0, 10);
}

function normalizeSearchText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function inferFciBroker(fundName: string): string {
  const n = fundName.toUpperCase();
  if (n.startsWith("FIMA ")) return "Banco Galicia";
  if (n.startsWith("SUPER ") || n.startsWith("SUPERFONDO")) return "Santander";
  if (n.startsWith("FBA ")) return "BBVA";
  if (n.startsWith("BALANZ")) return "Balanz";
  if (n.startsWith("COCOS")) return "Cocos Capital";
  if (n.startsWith("DELTA")) return "Delta / Personal Pay";
  if (n.startsWith("PREMIER")) return "Supervielle / IOL";
  if (n.startsWith("PIONERO")) return "Banco Macro";
  if (n.startsWith("PELLEGRINI")) return "Banco Nación";
  if (n.startsWith("1822 RAICES") || n.startsWith("RAICES")) return "Banco Provincia";
  if (n.startsWith("SBS")) return "SBS";
  if (n.startsWith("ADCAP")) return "Adcap / IOL";
  if (n.startsWith("COMPASS")) return "Compass";
  if (n.startsWith("SCHRODER")) return "Schroders";
  if (n.startsWith("GALILEO")) return "Galileo";
  if (n.startsWith("MEGAQM") || n.startsWith("QUINQUELA")) return "MegaQM";
  if (n.startsWith("CONSULTATIO")) return "Consultatio";
  if (n.startsWith("COHEN")) return "Cohen";
  if (n.startsWith("ALLARIA")) return "Allaria";
  if (n.startsWith("IAM ") || n.includes("MERCADO FONDO")) return "Bind / Mercado Pago";
  if (n.startsWith("ST ") || n.startsWith("TORONTO")) return "Banza / ST";
  if (n.startsWith("UALA") || n.startsWith("UILO")) return "Ualá";
  if (n.startsWith("HF ")) return "HSBC / Galicia Más";
  if (n.startsWith("ICBC") || n.startsWith("ALPHA")) return "ICBC";
  if (n.startsWith("LOMBARD")) return "Banco Patagonia";
  return "CAFCI Argentina";
}

function buildFciTicker(fundName: string): string {
  const clean = fundName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return `FCI-${clean || "FONDO"}`;
}

/**
 * Obtiene el padrón completo de Fondos Comunes de Inversión (CAFCI) desde ArgentinaDatos API
 * Incluye valor de cuotaparte oficial (VCP) de Mercado de Dinero, Renta Fija, Renta Mixta y Renta Variable
 */
export async function getCafciCatalog(): Promise<CafciFundQuote[]> {
  const now = Date.now();
  if (cachedCafciCatalog && now - cachedCafciCatalog.timestamp < CAFCI_CACHE_TTL_MS) {
    return cachedCafciCatalog.funds;
  }

  const endpoints = [
    { key: "mercadoDinero", label: "Money Market" },
    { key: "rentaFija", label: "Renta Fija" },
    { key: "rentaMixta", label: "Renta Mixta" },
    { key: "rentaVariable", label: "Renta Variable" },
  ];

  try {
    const responses = await Promise.allSettled(
      endpoints.map(async (ep) => {
        const res = await fetch(
          `https://api.argentinadatos.com/v1/finanzas/fci/${ep.key}/ultimo`,
          {
            next: { revalidate: 1800 },
            signal: AbortSignal.timeout(2800),
          }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data)
          ? data.map((item: any) => ({ ...item, _category: ep.label }))
          : [];
      })
    );

    const fundsMap = new Map<string, CafciFundQuote>();

    for (const r of responses) {
      if (r.status !== "fulfilled") continue;
      for (const item of r.value) {
        const rawName = typeof item.fondo === "string" ? item.fondo.trim() : "";
        const vcpRaw = Number(item.vcp);
        if (!rawName || !vcpRaw || isNaN(vcpRaw) || vcpRaw <= 0) continue;

        const isUsd = /DOLAR|DÓLAR|USD|U\$S/i.test(rawName);
        const vcpUnit = Number((vcpRaw / 1000).toFixed(6));
        const vcpPer1000 = Number(vcpRaw.toFixed(4));

        fundsMap.set(rawName.toUpperCase(), {
          ticker: buildFciTicker(rawName),
          name: rawName,
          broker: inferFciBroker(rawName),
          category: item._category || "FCI",
          currency: isUsd ? "USD" : "ARS",
          vcpUnit,
          vcpPer1000,
          date: item.fecha || new Date().toISOString().slice(0, 10),
          patrimonio: Number(item.patrimonio) || undefined,
        });
      }
    }

    const catalog = Array.from(fundsMap.values());
    if (catalog.length > 0) {
      cachedCafciCatalog = { funds: catalog, timestamp: now };
      return catalog;
    }
  } catch (err) {
    console.warn("Error fetching CAFCI catalog from ArgentinaDatos:", err);
  }

  return [];
}

/**
 * Busca Fondos Comunes de Inversión por nombre de fondo, banco o sociedad gerente
 * y devuelve su último Valor de Cuotaparte (VCP) oficial.
 */
export async function searchFciFunds(query: string): Promise<CafciFundQuote[]> {
  const catalog = await getCafciCatalog();
  const qNorm = normalizeSearchText(query);

  // Si no hay búsqueda escrita, devolver una selección curada de los principales FCIs con VCP en vivo
  if (!qNorm) {
    const popularResults: CafciFundQuote[] = [];
    for (const preset of POPULAR_ARGENTINA_FCIS) {
      const basePresetName = normalizeSearchText(preset.name.split("(")[0]);
      const match = catalog.find(
        (c) =>
          normalizeSearchText(c.name).includes(basePresetName) &&
          (c.name.includes("Clase A") || !c.name.includes("Clase"))
      ) || catalog.find((c) => normalizeSearchText(c.name).includes(basePresetName));

      if (match) {
        popularResults.push({
          ...match,
          ticker: preset.ticker,
          broker: preset.broker,
        });
      } else {
        popularResults.push({
          ticker: preset.ticker,
          name: preset.name,
          broker: preset.broker,
          category: "FCI Popular",
          currency: preset.defaultCurrency as "ARS" | "USD",
          vcpUnit: 0,
          vcpPer1000: 0,
          date: "",
        });
      }
    }
    return popularResults;
  }

  const tokens = qNorm.split(/\s+/).filter(Boolean);

  const scored: Array<{ fund: CafciFundQuote; score: number }> = [];

  for (const fund of catalog) {
    const haystack = normalizeSearchText(
      `${fund.name} ${fund.broker} ${fund.category}`
    );

    const allMatch = tokens.every((t) => haystack.includes(t));
    if (!allMatch) continue;

    let score = 0;
    const normName = normalizeSearchText(fund.name);
    if (normName.startsWith(tokens[0])) score += 30;
    if (fund.name.includes("Clase A")) score += 20; // Clase minorista individuo más habitual
    if (fund.name.includes("Clase B")) score += 10;
    if (fund.category === "Money Market") score += 8;

    scored.push({ fund, score });
  }

  // También revisar presets populares por si el usuario buscó "Mercado Pago", "Personal Pay" o "Uala"
  for (const preset of POPULAR_ARGENTINA_FCIS) {
    const presetHaystack = normalizeSearchText(`${preset.name} ${preset.broker}`);
    if (tokens.every((t) => presetHaystack.includes(t))) {
      const alreadyIncluded = scored.some(
        (s) => normalizeSearchText(s.fund.name) === normalizeSearchText(preset.name)
      );
      if (!alreadyIncluded) {
        const basePresetName = normalizeSearchText(preset.name.split("(")[0]);
        const liveMatch = catalog.find((c) =>
          normalizeSearchText(c.name).includes(basePresetName)
        );
        scored.push({
          fund: {
            ticker: preset.ticker,
            name: liveMatch ? liveMatch.name : preset.name,
            broker: preset.broker,
            category: liveMatch ? liveMatch.category : "FCI",
            currency: preset.defaultCurrency as "ARS" | "USD",
            vcpUnit: liveMatch ? liveMatch.vcpUnit : 0,
            vcpPer1000: liveMatch ? liveMatch.vcpPer1000 : 0,
            date: liveMatch ? liveMatch.date : "",
          },
          score: 50,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.fund.name.localeCompare(b.fund.name));
  return scored.slice(0, 20).map((s) => s.fund);
}

/**
 * Obtiene el último Valor de Cuotaparte (VCP) oficial para un FCI por su nombre o ticker
 */
export async function fetchFciQuote(
  nameOrTicker: string,
  referencePrice?: number | null
): Promise<(CafciFundQuote & { recommendedVcp: number }) | null> {
  const catalog = await getCafciCatalog();
  if (catalog.length === 0) return null;

  const cleanInput = normalizeSearchText(nameOrTicker);
  if (!cleanInput) return null;

  // 1. Verificar si corresponde a algún preset popular por ticker
  const preset = POPULAR_ARGENTINA_FCIS.find(
    (p) => normalizeSearchText(p.ticker) === cleanInput
  );
  const targetName = preset
    ? normalizeSearchText(preset.name.split("(")[0])
    : normalizeSearchText(nameOrTicker.split("(")[0]);

  // 2. Buscar coincidencia exacta primero, o coincidencia de Clase A / general
  let match =
    catalog.find((c) => normalizeSearchText(c.name) === cleanInput) ||
    catalog.find((c) => normalizeSearchText(c.name) === targetName) ||
    catalog.find(
      (c) =>
        normalizeSearchText(c.name).includes(targetName) &&
        c.name.includes("Clase A")
    ) ||
    catalog.find((c) => normalizeSearchText(c.name).includes(targetName));

  if (!match) {
    // Buscar por palabras clave principales
    const words = targetName
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !["FCI", "FONDO", "CLASE", "PESOS"].includes(w));
    if (words.length > 0) {
      match =
        catalog.find(
          (c) =>
            words.every((w) => normalizeSearchText(c.name).includes(w)) &&
            c.name.includes("Clase A")
        ) ||
        catalog.find((c) =>
          words.every((w) => normalizeSearchText(c.name).includes(w))
        );
    }
  }

  if (!match) return null;

  // Determinar si el usuario usa VCP unitario (ej. 86.80) o VCP cada 1.000 cuotapartes (ej. 86802.60)
  let recommendedVcp = match.vcpUnit;
  if (typeof referencePrice === "number" && referencePrice > 0) {
    const diffUnit = Math.abs(referencePrice - match.vcpUnit) / Math.max(1, match.vcpUnit);
    const diff1000 =
      Math.abs(referencePrice - match.vcpPer1000) / Math.max(1, match.vcpPer1000);
    recommendedVcp = diff1000 < diffUnit ? match.vcpPer1000 : match.vcpUnit;
  }

  return {
    ...match,
    recommendedVcp,
  };
}

export interface HydratedInvestment {
  id: string;
  userId?: string;
  householdId?: string;
  ticker: string;
  name: string;
  assetType: string;
  quantity: number;
  buyPrice: number | null;
  currency: string;
  manualPrice: number | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Valores calculados
  currentPrice: number;
  priceCurrency: "ARS" | "USD";
  currentPriceArs: number;
  totalValuationArs: number;
  totalValuationUsd: number;
  totalCostArs: number | null;
  gainLossArs: number | null;
  gainLossPct: number | null;
  dailyChangePct: number | null;
  hasLiveQuote: boolean;
}

export interface PortfolioSummary {
  totalValuationArs: number;
  totalValuationUsd: number;
  totalCostArs: number;
  totalGainLossArs: number;
  totalGainLossPct: number;
  rates: ExchangeRates;
  assetTypeBreakdown: Array<{
    type: string;
    totalArs: number;
    pct: number;
  }>;
}

const portfolioCache = new Map<
  string,
  { data: { investments: HydratedInvestment[]; summary: PortfolioSummary }; timestamp: number }
>();
const PORTFOLIO_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

export function invalidatePortfolioCache() {
  portfolioCache.clear();
}

export async function hydrateInvestments(
  rawInvestments: Array<{
    id: string;
    userId?: string;
    householdId?: string;
    ticker: string;
    name: string;
    assetType: string;
    quantity: number;
    buyPrice: number | null;
    currency: string;
    manualPrice: number | null;
    notes: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>
): Promise<{ investments: HydratedInvestment[]; summary: PortfolioSummary }> {
  if (rawInvestments.length === 0) {
    const fallbackRates: ExchangeRates = cachedRates?.rates || {
      mep: 1535,
      ccl: 1615,
      blue: 1545,
      oficial: 1520,
      updatedAt: "",
    };
    return {
      investments: [],
      summary: {
        totalValuationArs: 0,
        totalValuationUsd: 0,
        totalCostArs: 0,
        totalGainLossArs: 0,
        totalGainLossPct: 0,
        rates: fallbackRates,
        assetTypeBreakdown: [],
      },
    };
  }

  // Clave de caché basada en los campos del activo (chequear ANTES de llamar a APIs externas)
  const cacheKey = rawInvestments
    .map(
      (i) =>
        `${i.id}_${i.ticker}_${i.name}_${i.assetType}_${i.quantity}_${i.buyPrice || 0}_${i.manualPrice || 0}_${i.currency}_${i.notes || ""}`
    )
    .sort()
    .join("|");

  const now = Date.now();
  const cached = portfolioCache.get(cacheKey);
  if (cached && now - cached.timestamp < PORTFOLIO_CACHE_TTL) {
    return cached.data;
  }

  const rates = await getExchangeRates();

  // Obtener cotizaciones de mercado en paralelo con tolerancia a fallas
  const quotesPromises = rawInvestments.map(async (inv) => {
    // Si es un FCI, Plazo Fijo, Caución u otro activo de cotización manual, no consultar Yahoo Finance
    const isManualAssetType =
      inv.assetType === "FCI" ||
      inv.assetType === "PLAZO_FIJO" ||
      inv.assetType === "ON" ||
      inv.ticker.startsWith("FCI-") ||
      inv.ticker.startsWith("PF-") ||
      inv.ticker.startsWith("ON-");
    if (isManualAssetType || (inv.manualPrice && inv.manualPrice > 0)) {
      return { id: inv.id, quote: null };
    }
    const q = await fetchTickerQuote(inv.ticker);
    return { id: inv.id, quote: q };
  });

  const quotesResults = await Promise.all(quotesPromises);
  const quotesMap = new Map<string, MarketQuote | null>();
  for (const r of quotesResults) {
    quotesMap.set(r.id, r.quote);
  }

  let totalValuationArs = 0;
  let totalCostArs = 0;
  let hasAnyCostBasis = false;
  const typeMap: Record<string, number> = {};

  const investments: HydratedInvestment[] = rawInvestments.map((inv) => {
    const liveQuote = quotesMap.get(inv.id);
    const hasLiveQuote = !!liveQuote;

    // Precio unitario
    let unitPrice = 0;
    let priceCurrency: "ARS" | "USD" = (inv.currency as "ARS" | "USD") || "ARS";

    if (liveQuote) {
      unitPrice = liveQuote.price;
      priceCurrency = liveQuote.currency;
    } else if (typeof inv.manualPrice === "number" && inv.manualPrice > 0) {
      unitPrice = inv.manualPrice;
    } else if (typeof inv.buyPrice === "number" && inv.buyPrice > 0) {
      unitPrice = inv.buyPrice;
    }

    const unitPriceArs =
      priceCurrency === "USD" ? unitPrice * rates.mep : unitPrice;
    const totalValuation = unitPriceArs * inv.quantity;

    // Costo inicial para calcular P&L
    let costArs: number | null = null;
    let gainLossArs: number | null = null;
    let gainLossPct: number | null = null;

    if (typeof inv.buyPrice === "number" && inv.buyPrice > 0) {
      hasAnyCostBasis = true;
      const buyPriceInArs =
        inv.currency === "USD" ? inv.buyPrice * rates.mep : inv.buyPrice;
      costArs = buyPriceInArs * inv.quantity;
      gainLossArs = totalValuation - costArs;
      gainLossPct = costArs > 0 ? (gainLossArs / costArs) * 100 : 0;
      totalCostArs += costArs;
    }

    totalValuationArs += totalValuation;
    typeMap[inv.assetType] = (typeMap[inv.assetType] || 0) + totalValuation;

    return {
      ...inv,
      currentPrice: unitPrice,
      priceCurrency,
      currentPriceArs: unitPriceArs,
      totalValuationArs: totalValuation,
      totalValuationUsd: rates.mep > 0 ? totalValuation / rates.mep : 0,
      totalCostArs: costArs,
      gainLossArs,
      gainLossPct,
      dailyChangePct: liveQuote?.changePercent ?? null,
      hasLiveQuote,
    };
  });

  const totalValuationUsd = rates.mep > 0 ? totalValuationArs / rates.mep : 0;
  const totalGainLossArs = hasAnyCostBasis ? totalValuationArs - totalCostArs : 0;
  const totalGainLossPct =
    hasAnyCostBasis && totalCostArs > 0 ? (totalGainLossArs / totalCostArs) * 100 : 0;

  const assetTypeBreakdown = Object.entries(typeMap).map(([type, amount]) => ({
    type,
    totalArs: amount,
    pct: totalValuationArs > 0 ? (amount / totalValuationArs) * 100 : 0,
  }));

  const result = {
    investments,
    summary: {
      totalValuationArs,
      totalValuationUsd,
      totalCostArs: hasAnyCostBasis ? totalCostArs : 0,
      totalGainLossArs,
      totalGainLossPct,
      rates,
      assetTypeBreakdown,
    },
  };

  portfolioCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}
