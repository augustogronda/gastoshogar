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

// Caché en memoria para evitar llamadas redundantes repetidas
let cachedRates: { rates: ExchangeRates; timestamp: number } | null = null;
const quoteCache = new Map<string, { quote: MarketQuote; timestamp: number }>();

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

export const POPULAR_ARGENTINA_ASSETS = [
  // CEDEARs Principales
  { ticker: "SPY.BA", name: "S&P 500 ETF (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "AAPL.BA", name: "Apple Inc. (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "MELI.BA", name: "MercadoLibre (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "NVDA.BA", name: "NVIDIA Corp. (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "KO.BA", name: "Coca-Cola (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "MSFT.BA", name: "Microsoft (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "TSLA.BA", name: "Tesla (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "QQQ.BA", name: "Nasdaq 100 ETF (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "DIA.BA", name: "Dow Jones ETF (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "AMZN.BA", name: "Amazon.com (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },
  { ticker: "GOOGL.BA", name: "Alphabet (Google) (CEDEAR)", assetType: "CEDEAR", defaultCurrency: "ARS" },

  // Acciones y Bonos Locales
  { ticker: "GGAL.BA", name: "Grupo Financiero Galicia", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "YPFD.BA", name: "YPF S.A.", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "PAMP.BA", name: "Pampa Energía", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "TXAR.BA", name: "Ternium Argentina", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "BMA.BA", name: "Banco Macro", assetType: "ACCION", defaultCurrency: "ARS" },
  { ticker: "AL30.BA", name: "Bono AL30 (Bonar 2030)", assetType: "BONO", defaultCurrency: "ARS" },
  { ticker: "GD30.BA", name: "Bono GD30 (Global 2030)", assetType: "BONO", defaultCurrency: "ARS" },

  // Cripto
  { ticker: "BTC-USD", name: "Bitcoin", assetType: "CRYPTO", defaultCurrency: "USD" },
  { ticker: "ETH-USD", name: "Ethereum", assetType: "CRYPTO", defaultCurrency: "USD" },
  { ticker: "SOL-USD", name: "Solana", assetType: "CRYPTO", defaultCurrency: "USD" },
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
const PORTFOLIO_CACHE_TTL = 3 * 60 * 1000; // 3 minutos

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
  const rates = await getExchangeRates();

  if (rawInvestments.length === 0) {
    return {
      investments: [],
      summary: {
        totalValuationArs: 0,
        totalValuationUsd: 0,
        totalCostArs: 0,
        totalGainLossArs: 0,
        totalGainLossPct: 0,
        rates,
        assetTypeBreakdown: [],
      },
    };
  }

  // Clave de caché basada en los IDs y cantidades
  const cacheKey = rawInvestments
    .map((i) => `${i.id}_${i.quantity}_${i.manualPrice || 0}`)
    .sort()
    .join("|");

  const now = Date.now();
  const cached = portfolioCache.get(cacheKey);
  if (cached && now - cached.timestamp < PORTFOLIO_CACHE_TTL) {
    return cached.data;
  }

  // Obtener cotizaciones de mercado en paralelo con tolerancia a fallas
  const quotesPromises = rawInvestments.map(async (inv) => {
    // Si es un FCI o activo con precio manual y sin ticker bursátil estándar, saltear
    if (inv.manualPrice && (inv.assetType === "FCI" || inv.ticker.startsWith("FCI-"))) {
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
