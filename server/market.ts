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
  source: "YahooFinance";
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
  const meta = await fetchYahooMeta(symbol);
  const nativePrice = Number(meta?.regularMarketPrice);
  const nativeCurrency = String(meta?.currency ?? "UNKNOWN");
  if (!meta || !Number.isFinite(nativePrice) || nativePrice <= 0) return null;
  const normalizedCurrency = nativeCurrency.toUpperCase() === "GBX" || nativeCurrency.toUpperCase() === "GBP" && symbol.endsWith(".L") ? "GBP" : nativeCurrency.toUpperCase();
  const fxRate = normalizedCurrency === "KRW" ? 1 : await getKrwRate(normalizedCurrency);
  if (!fxRate) throw new Error(`KRW exchange rate unavailable for ${nativeCurrency}`);
  const adjustedNativePrice = normalizedCurrency === "GBP" && nativeCurrency.toUpperCase() === "GBX" ? nativePrice / 100 : nativePrice;
  const price = adjustedNativePrice * fxRate;
  return {
    symbol: String(meta.symbol ?? symbol).toUpperCase(),
    price,
    currency: "KRW",
    nativePrice,
    nativeCurrency,
    fxRate,
    name: meta.longName ?? meta.shortName,
    observedAt: new Date((Number(meta.regularMarketTime) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    source: "YahooFinance",
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
