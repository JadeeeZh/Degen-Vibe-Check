import { SocialQuality, SocialSignals } from "@/lib/types";

type SocialFetchInput = {
  address: string;
  symbol: string;
  name: string;
  chainId: string;
  boosts: number;
  paidOrders: number;
  totalTxns24h: number;
  volumeLiquidityRatio: number;
};

type CountResult = {
  count: number | null;
  capped: boolean;
  limited: boolean;
};

type XSearchResponse = {
  data?: Array<{ id: string }>;
  meta?: {
    next_token?: string;
    result_count?: number;
  };
};

type NeynarSearchResponse = {
  result?: {
    casts?: Array<{ hash: string }>;
    next?: {
      cursor?: string;
    };
  };
};

const X_API = "https://api.x.com/2/tweets/search/recent";
const NEYNAR_API = "https://api.neynar.com/v2/farcaster/cast/search/";

function clampNonNegative(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, value);
}

function getSearchMetadata(symbol: string, name: string) {
  const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const cleanName = name.replace(/\s+/g, " ").trim().replace(/"/g, "");
  const includeSymbol = cleanSymbol.length >= 4;
  const includeName = cleanName.length >= 5;

  return {
    cleanSymbol,
    cleanName,
    includeSymbol,
    includeName,
    limited: !includeSymbol || !includeName,
  };
}

function buildXQuery(input: { address: string; symbol: string; name: string }) {
  const metadata = getSearchMetadata(input.symbol, input.name);
  const clauses = [`"${input.address}"`];

  if (metadata.includeName) {
    clauses.push(`"${metadata.cleanName}"`);
  }

  if (metadata.includeSymbol) {
    clauses.push(`"$${metadata.cleanSymbol}"`);
  }

  return {
    query: `(${clauses.join(" OR ")}) -is:retweet`,
    limited: metadata.limited,
  };
}

function buildFarcasterQuery(
  input: { address: string; symbol: string; name: string },
  start: Date,
  end: Date,
) {
  const metadata = getSearchMetadata(input.symbol, input.name);
  const clauses = [`"${input.address}"`];

  if (metadata.includeName) {
    clauses.push(`"${metadata.cleanName}"`);
  }

  if (metadata.includeSymbol) {
    clauses.push(`"$${metadata.cleanSymbol}"`);
  }

  const after = start.toISOString().slice(0, 19);
  const before = end.toISOString().slice(0, 19);

  return {
    query: `(${clauses.join(" | ")}) after:${after} before:${before}`,
    limited: metadata.limited,
  };
}

async function fetchXMentionCount(
  query: string,
  start: Date,
  end: Date,
): Promise<CountResult> {
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  if (!bearerToken) {
    return { count: null, capped: false, limited: true };
  }

  const maxPages = Number(process.env.X_SEARCH_MAX_PAGES ?? "1");
  let nextToken: string | null = null;
  let total = 0;
  let page = 0;

  while (page < maxPages) {
    const url = new URL(X_API);
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("sort_order", "recency");
    url.searchParams.set("start_time", start.toISOString());
    url.searchParams.set("end_time", end.toISOString());

    if (nextToken) {
      url.searchParams.set("next_token", nextToken);
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
    });

    if (!response.ok) {
      return { count: null, capped: false, limited: true };
    }

    const payload = (await response.json()) as XSearchResponse;
    total += payload.meta?.result_count ?? payload.data?.length ?? 0;
    nextToken = payload.meta?.next_token ?? null;
    page += 1;

    if (!nextToken) {
      return { count: total, capped: false, limited: false };
    }
  }

  return { count: total, capped: true, limited: false };
}

async function fetchNeynarMentionCount(
  query: string,
): Promise<CountResult> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return { count: null, capped: false, limited: true };
  }

  const maxPages = Number(process.env.NEYNAR_SEARCH_MAX_PAGES ?? "2");
  let cursor: string | null = null;
  let total = 0;
  let page = 0;

  while (page < maxPages) {
    const url = new URL(NEYNAR_API);
    url.searchParams.set("q", query);
    url.searchParams.set("mode", "literal");
    url.searchParams.set("sort_type", "desc_chron");
    url.searchParams.set("limit", "100");

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      return { count: null, capped: false, limited: true };
    }

    const payload = (await response.json()) as NeynarSearchResponse;
    total += payload.result?.casts?.length ?? 0;
    cursor = payload.result?.next?.cursor ?? null;
    page += 1;

    if (!cursor) {
      return { count: total, capped: false, limited: false };
    }
  }

  return { count: total, capped: true, limited: false };
}

function calculateGrowth(nowCount: number | null, previousCount: number | null) {
  if (nowCount === null || previousCount === null) {
    return null;
  }

  if (previousCount <= 0) {
    return nowCount > 0 ? 100 : 0;
  }

  return ((nowCount - previousCount) / previousCount) * 100;
}

function deriveSocialQuality(input: {
  xMentions24h: number | null;
  xMentions7d: number | null;
  farcasterMentions24h: number | null;
  farcasterMentions7d: number | null;
  growth24hPct: number | null;
  boosts: number;
  paidOrders: number;
  totalTxns24h: number;
  volumeLiquidityRatio: number;
}): SocialQuality {
  const combined24h = (input.xMentions24h ?? 0) + (input.farcasterMentions24h ?? 0);
  const combined7d = (input.xMentions7d ?? 0) + (input.farcasterMentions7d ?? 0);
  const crossPlatform =
    (input.xMentions24h ?? 0) > 0 && (input.farcasterMentions24h ?? 0) > 0;
  const paidExposure = input.boosts > 0 || input.paidOrders > 0;
  const weakConversion = combined24h >= 15 && input.totalTxns24h < 100;
  const hotFlow = input.totalTxns24h >= 500 || input.volumeLiquidityRatio >= 1;

  if (combined24h < 5 && combined7d < 20 && input.totalTxns24h < 100) {
    return "muted";
  }

  if (paidExposure && combined24h >= 5) {
    return "paid_hype";
  }

  if (
    combined24h >= 40 &&
    (input.growth24hPct ?? 0) >= 40 &&
    hotFlow
  ) {
    return "overheated";
  }

  if (
    combined24h >= 10 &&
    crossPlatform &&
    !paidExposure &&
    (input.growth24hPct ?? 0) >= 15 &&
    input.totalTxns24h >= 100
  ) {
    return "organic";
  }

  if (weakConversion) {
    return "mixed";
  }

  return "mixed";
}

export async function fetchSocialSignals(input: SocialFetchInput): Promise<SocialSignals> {
  const now = Date.now();
  const last24hStart = new Date(now - 24 * 60 * 60 * 1000);
  const prev24hStart = new Date(now - 48 * 60 * 60 * 1000);
  const last7dStart = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const xSearch = buildXQuery(input);
  const farcaster24h = buildFarcasterQuery(input, last24hStart, new Date(now));
  const farcasterPrev24h = buildFarcasterQuery(input, prev24hStart, last24hStart);
  const farcaster7d = buildFarcasterQuery(input, last7dStart, new Date(now));

  const [
    x24h,
    xPrev24h,
    x7d,
    farcaster24hCount,
    farcasterPrev24hCount,
    farcaster7dCount,
  ] = await Promise.all([
    fetchXMentionCount(xSearch.query, last24hStart, new Date(now)),
    fetchXMentionCount(xSearch.query, prev24hStart, last24hStart),
    fetchXMentionCount(xSearch.query, last7dStart, new Date(now)),
    fetchNeynarMentionCount(farcaster24h.query),
    fetchNeynarMentionCount(farcasterPrev24h.query),
    fetchNeynarMentionCount(farcaster7d.query),
  ]);

  const xMentions24h = clampNonNegative(x24h.count);
  const xMentions7d = clampNonNegative(x7d.count);
  const farcasterMentions24h = clampNonNegative(farcaster24hCount.count);
  const farcasterMentions7d = clampNonNegative(farcaster7dCount.count);
  const growth24hPct = calculateGrowth(
    (xMentions24h ?? 0) + (farcasterMentions24h ?? 0),
    (xPrev24h.count ?? 0) + (farcasterPrev24hCount.count ?? 0),
  );

  const degradedReasons: string[] = [];

  if (xMentions24h === null || xMentions7d === null) {
    degradedReasons.push("X data unavailable");
  } else if (xSearch.limited || x24h.capped || x7d.capped) {
    degradedReasons.push("X signal limited");
  }

  if (farcasterMentions24h === null || farcasterMentions7d === null) {
    degradedReasons.push("Farcaster signal limited");
  } else if (
    farcaster24h.limited ||
    farcaster24hCount.capped ||
    farcaster7dCount.capped
  ) {
    degradedReasons.push("Farcaster signal limited");
  }

  if (degradedReasons.length > 0) {
    degradedReasons.push("Using market participation proxies");
  }

  const socialQuality = deriveSocialQuality({
    xMentions24h,
    xMentions7d,
    farcasterMentions24h,
    farcasterMentions7d,
    growth24hPct,
    boosts: input.boosts,
    paidOrders: input.paidOrders,
    totalTxns24h: input.totalTxns24h,
    volumeLiquidityRatio: input.volumeLiquidityRatio,
  });

  return {
    available:
      xMentions24h !== null ||
      xMentions7d !== null ||
      farcasterMentions24h !== null ||
      farcasterMentions7d !== null,
    xMentions24h,
    xMentions7d,
    farcasterMentions24h,
    farcasterMentions7d,
    growth24hPct,
    boosts: input.boosts,
    paidOrders: input.paidOrders,
    socialQuality,
    degradedReasons: [...new Set(degradedReasons)],
  };
}
