import { PairMetrics } from "@/lib/types";

type DexPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  url?: string;
  pairCreatedAt?: number;
  liquidity?: {
    usd?: number;
  };
  volume?: {
    h24?: number;
  };
  priceChange?: {
    h24?: number;
  };
  txns?: {
    h24?: {
      buys?: number;
      sells?: number;
    };
  };
  fdv?: number;
  marketCap?: number;
  labels?: string[];
  boosts?: {
    active?: number;
  };
  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
  quoteToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
};

type DexSearchResponse = {
  pairs?: DexPair[];
};

type DexOrderResponse = Array<{
  status?: string;
  type?: string;
}>;

const DEX_API = "https://api.dexscreener.com";

async function fetchJson<T>(path: string) {
  const response = await fetch(`${DEX_API}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`DexScreener request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizePair(pair: DexPair, paidOrderCount: number): PairMetrics | null {
  if (!pair.chainId || !pair.dexId || !pair.pairAddress || !pair.baseToken?.address) {
    return null;
  }

  return {
    chainId: pair.chainId,
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    url: pair.url,
    pairCreatedAt: pair.pairCreatedAt,
    liquidityUsd: pair.liquidity?.usd ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    priceChange24h: pair.priceChange?.h24 ?? 0,
    buys24h: pair.txns?.h24?.buys ?? 0,
    sells24h: pair.txns?.h24?.sells ?? 0,
    marketCap: pair.marketCap ?? 0,
    fdv: pair.fdv ?? 0,
    labels: pair.labels ?? [],
    boostsActive: pair.boosts?.active ?? 0,
    paidOrderCount,
    baseToken: {
      address: pair.baseToken.address,
      name: pair.baseToken.name ?? "Unknown Token",
      symbol: pair.baseToken.symbol ?? "UNKNOWN",
    },
    quoteToken: {
      address: pair.quoteToken?.address ?? "",
      name: pair.quoteToken?.name ?? "Unknown Quote",
      symbol: pair.quoteToken?.symbol ?? "UNKNOWN",
    },
  };
}

async function fetchTokenOrders(chainId: string, tokenAddress: string) {
  try {
    const orders = await fetchJson<DexOrderResponse>(
      `/orders/v1/${chainId}/${tokenAddress}`,
    );

    return orders.filter((order) => order.status === "approved").length;
  } catch {
    return 0;
  }
}

export async function fetchBestPairForToken(chainId: string, tokenAddress: string) {
  const tokenPairs = await fetchJson<DexSearchResponse>(`/token-pairs/v1/${chainId}/${tokenAddress}`);
  const pairs = tokenPairs.pairs ?? [];

  if (pairs.length === 0) {
    return null;
  }

  const primaryPair = pairs.reduce((best, current) => {
    const currentLiquidity = current.liquidity?.usd ?? 0;
    const bestLiquidity = best?.liquidity?.usd ?? 0;

    if (!best || currentLiquidity > bestLiquidity) {
      return current;
    }

    return best;
  }, pairs[0]);

  const paidOrderCount = await fetchTokenOrders(chainId, tokenAddress);
  return normalizePair(primaryPair, paidOrderCount);
}

export async function searchBestTokenPair(query: string) {
  const encodedQuery = encodeURIComponent(query.trim());
  const search = await fetchJson<DexSearchResponse>(
    `/latest/dex/search?q=${encodedQuery}`,
  );

  const pairs = search.pairs ?? [];
  if (pairs.length === 0) {
    throw new Error("No matching token pairs found on DexScreener.");
  }

  const bestSearchPair = pairs.reduce((best, current) => {
    const currentLiquidity = current.liquidity?.usd ?? 0;
    const bestLiquidity = best?.liquidity?.usd ?? 0;

    if (!best || currentLiquidity > bestLiquidity) {
      return current;
    }

    return best;
  }, pairs[0]);

  if (!bestSearchPair?.chainId || !bestSearchPair.baseToken?.address) {
    throw new Error("DexScreener returned incomplete pair data.");
  }

  const tokenAddress = bestSearchPair.baseToken.address;
  const normalized =
    (await fetchBestPairForToken(bestSearchPair.chainId, tokenAddress)) ??
    normalizePair(bestSearchPair, 0);

  if (!normalized) {
    throw new Error("Failed to normalize DexScreener pair data.");
  }

  return normalized;
}
