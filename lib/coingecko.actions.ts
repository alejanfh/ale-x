"use server";
import qs from "query-string";

const BASE_URL = process.env.COINGECKO_BASE_URL;
const API_KEY = process.env.COINGECKO_API_KEY;
const SEARCH_LIMIT = 10;

if (!BASE_URL) throw new Error("Could not get base url");
if (!API_KEY) throw new Error("Could not get api key");

export async function fetcher<T>(
  endpoint: string,
  params?: QueryParams,
  revalidate = 60,
): Promise<T> {
  const url = qs.stringifyUrl(
    {
      url: `${BASE_URL}/${endpoint}`,
      query: params,
    },
    { skipEmptyString: true, skipNull: true },
  );

  const response = await fetch(url, {
    headers: {
      "x-cg-demo-api-key": API_KEY,
      "Content-Type": "application/json",
    } as Record<string, string>,
    next: { revalidate },
  });

  if (!response.ok) {
    const errorBody: CoinGeckoErrorBody = await response
      .json()
      .catch(() => ({}));

    console.log("errorBody.", errorBody);

    throw new Error(
      `API Error: ${response.status}: ${errorBody.error || response.statusText}`,
    );
  }

  return response.json();
}

export async function getPools(
  id: string,
  network?: string | null,
  contractAddress?: string | null,
): Promise<PoolData> {
  const fallback: PoolData = {
    id: "",
    address: "",
    name: "",
    network: "",
  };

  if (network && contractAddress) {
    try {
      const poolData = await fetcher<{ data: PoolData[] }>(
        `/onchain/networks/${network}/tokens/${contractAddress}/pools`,
      );

      return poolData.data?.[0] ?? fallback;
    } catch (error) {
      console.error(
        "Error fetching pool data with network and contract address:",
        error,
      );
      return fallback;
    }
  }

  try {
    const poolData = await fetcher<{ data: PoolData[] }>(
      "/onchain/search/pools",
      { query: id },
    );

    return poolData.data?.[0] ?? fallback;
  } catch {
    return fallback;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cgFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());

  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ─── Raw CoinGecko shapes ─────────────────────────────────────────────────────

interface RawSearchCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  large: string;
  market_cap_rank: number | null;
}

interface RawSearchResponse {
  coins: RawSearchCoin[];
}

interface RawMarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi: null;
  last_updated: string;
}

// ─── Public action ────────────────────────────────────────────────────────────

/**
 * Two-step merge:
 *   1. /search        → coin ids + metadata (no price)
 *   2. /coins/markets → price + 24h change for those ids
 *
 * Returns a unified SearchCoin[] ready for the modal.
 */
export async function searchCoins(query: string): Promise<SearchCoin[]> {
  if (!query.trim()) return [];

  // Step 1 — get matching coin ids
  const { coins: searchHits } = await cgFetch<RawSearchResponse>("/search", {
    query,
  });

  if (searchHits.length === 0) return [];

  const topIds = searchHits
    .slice(0, SEARCH_LIMIT)
    .map((c) => c.id)
    .join(",");

  // Step 2 — enrich with market data (price, change)
  const markets = await cgFetch<RawMarketCoin[]>("/coins/markets", {
    vs_currency: "usd",
    ids: topIds,
    order: "market_cap_desc",
    sparkline: "false",
    price_change_percentage: "24h",
  });

  // Build a lookup so the merge is O(1) per coin
  const marketById = new Map(markets.map((m) => [m.id, m]));

  // Merge: preserve search ranking order, attach market data where available
  return searchHits.slice(0, SEARCH_LIMIT).map((hit) => {
    const market = marketById.get(hit.id);

    return {
      id: hit.id,
      name: hit.name,
      symbol: hit.symbol.toUpperCase(),
      thumb: hit.thumb,
      large: hit.large,
      market_cap_rank: hit.market_cap_rank ?? null,
      data: {
        price: market?.current_price,
        price_change_percentage_24h: market?.price_change_percentage_24h ?? 0,
      },
    } satisfies SearchCoin;
  });
}

// ─── Trending ─────────────────────────────────────────────────────────────────

interface RawTrendingItem {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  large: string;
  data: {
    price: number;
    price_change_percentage_24h: {
      usd: number;
    };
  };
}

interface RawTrendingResponse {
  coins: Array<{ item: RawTrendingItem }>;
}

/**
 * Fetches trending coins from CoinGecko.
 * Intended for use in Server Components — call it directly and pass the result
 * to <SearchModal initialTrendingCoins={trendingCoins} />.
 */
export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const { coins } = await cgFetch<RawTrendingResponse>("/search/trending");
  return coins as TrendingCoin[];
}
