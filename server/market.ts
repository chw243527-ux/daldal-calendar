import { callDataApi } from "./_core/dataApi";

export type MarketQuote = {
  symbol: string;
  price: number;
  currency: string;
  nativePrice?: number;
  nativeCurrency?: string;
  fxRate?: number;
  name?: string;
  observedAt: string;
  source: "YahooFinance" | "Bithumb";
};

const quoteCache = new Map<string, { expiresAt: number; quote: MarketQuote }>();
const fxCache = new Map<string, { expiresAt: number; rate: number }>();
const CACHE_TTL_MS = 60_000;

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export async function getMarketQuotes(symbols: string[]) {
  const unique = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))].slice(0, 40);
  const now = Date.now();
  const result: MarketQuote[] = [];
  const pending: Array<{ symbol: string; promise: Promise<MarketQuote | null> }> = [];

  for (const symbol of unique) {
    const cached = quoteCache.get(symbol);
    if (cached && cached.expiresAt > now) result.push(cached.quote);
    else pending.push({ symbol, promise: fetchQuote(symbol) });
  }

  const fetched = await Promise.all(pending.map(async ({ symbol, promise }) => {
    try {
      const quote = await promise;
      if (quote) {
        quoteCache.set(symbol, { expiresAt: now + CACHE_TTL_MS, quote });
        return quote;
      }
    } catch (error) {
      console.warn(`[Market] quote unavailable for ${symbol}:`, error instanceof Error ? error.message : error);
    }
    return null;
  }));
  return [...result, ...fetched.filter((quote): quote is MarketQuote => Boolean(quote))];
}

async function fetchQuote(symbol: string): Promise<MarketQuote | null> {
  if (symbol.startsWith("BITHUMB:")) {
    const pair = symbol.slice("BITHUMB:".length);
    try {
      return await fetchBithumbQuote(pair);
    } catch (error) {
      console.warn(`[Market] Bithumb unavailable for ${pair}, using Yahoo KRW fallback:`, error instanceof Error ? error.message : error);
      const fallback = await fetchYahooQuote(pair.replace(/_/g, "-"));
      return fallback ? { ...fallback, symbol, name: `${fallback.name ?? pair} (빗썸 호환)` } : null;
    }
  }
  return fetchYahooQuote(symbol);
}

async function fetchYahooQuote(symbol: string): Promise<MarketQuote | null> {
  const meta = await fetchYahooMeta(symbol);
  const nativePrice = Number(meta?.regularMarketPrice);
  const nativeCurrency = String(meta?.currency ?? "UNKNOWN");
  if (!meta || !Number.isFinite(nativePrice) || nativePrice <= 0) return null;
  const normalizedCurrency = nativeCurrency.toUpperCase() === "GBX" || (nativeCurrency.toUpperCase() === "GBP" && symbol.endsWith(".L")) ? "GBP" : nativeCurrency.toUpperCase();
  const fxRate = normalizedCurrency === "KRW" ? 1 : await getKrwRate(normalizedCurrency);
  if (!fxRate) throw new Error(`KRW exchange rate unavailable for ${nativeCurrency}`);
  const adjustedNativePrice = normalizedCurrency === "GBP" && nativeCurrency.toUpperCase() === "GBX" ? nativePrice / 100 : nativePrice;
  return {
    symbol: String(meta.symbol ?? symbol).toUpperCase(),
    price: adjustedNativePrice * fxRate,
    currency: "KRW",
    nativePrice,
    nativeCurrency,
    fxRate,
    name: meta.longName ?? meta.shortName,
    observedAt: new Date((Number(meta.regularMarketTime) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    source: "YahooFinance",
  };
}

async function fetchBithumbQuote(pair: string): Promise<MarketQuote | null> {
  const normalizedPair = pair.trim().toUpperCase().replace(/-/g, "_");
  const response = await fetch(`https://api.bithumb.com/public/ticker/${encodeURIComponent(normalizedPair)}`);
  if (!response.ok) throw new Error(`Bithumb HTTP ${response.status}`);
  const payload = await response.json() as { status?: string; data?: { closing_price?: string; date?: string } };
  const price = Number(payload.data?.closing_price);
  if (payload.status !== "0000" || !Number.isFinite(price) || price <= 0) return null;
  const observedAt = Number(payload.data?.date);
  return {
    symbol: `BITHUMB:${normalizedPair}`,
    price,
    currency: "KRW",
    nativePrice: price,
    nativeCurrency: "KRW",
    fxRate: 1,
    name: `${normalizedPair.split("_")[0]} (빗썸)`,
    observedAt: new Date(Number.isFinite(observedAt) ? observedAt : Date.now()).toISOString(),
    source: "Bithumb",
  };
}

async function fetchYahooMeta(symbol: string) {
  const payload = await callDataApi("YahooFinance/get_stock_chart", {
    query: { symbol, interval: "1d", range: "5d", includeAdjustedClose: "true", includePrePost: "false" },
  }) as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; currency?: string; longName?: string; shortName?: string; regularMarketTime?: number; symbol?: string } }> } };
  return payload.chart?.result?.[0]?.meta;
}

async function getKrwRate(currency: string) {
  const cached = fxCache.get(currency);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;
  const fxMeta = await fetchYahooMeta(`${currency}KRW=X`);
  const rate = Number(fxMeta?.regularMarketPrice);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  fxCache.set(currency, { expiresAt: Date.now() + CACHE_TTL_MS, rate });
  return rate;
}
