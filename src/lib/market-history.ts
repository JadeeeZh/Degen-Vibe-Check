import { hoursSince } from "@/lib/utils";

type OhlcvResponse = {
  data?: {
    attributes?: {
      ohlcv_list?: Array<[number, number, number, number, number, number]>;
    };
  };
};

type MarketHistorySnapshot = {
  launchSpikeRatio: number | null;
  peakToCurrentDrawdown: number | null;
  historicalWindowHours: number | null;
  degradedReasons: string[];
};

type Candle = {
  timestampSec: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
};

const GECKO_NETWORKS: Record<string, string> = {
  ethereum: "eth",
  bsc: "bsc",
  polygon: "polygon_pos",
  avalanche: "avax",
  arbitrum: "arbitrum",
  optimism: "optimism",
  linea: "linea",
  base: "base",
  scroll: "scroll",
  fantom: "ftm",
  cronos: "cro",
};

function unique(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

async function fetchOhlcv(
  network: string,
  poolAddress: string,
  timeframe: "hour" | "day",
  beforeTimestamp: number,
  limit: number,
) {
  const params = new URLSearchParams({
    aggregate: "1",
    before_timestamp: String(beforeTimestamp),
    limit: String(limit),
    currency: "usd",
    token: "base",
    include_empty_intervals: "true",
  });
  const response = await fetch(
    `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?${params}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json;version=20230302",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GeckoTerminal OHLCV failed: ${response.status}`);
  }

  const payload = (await response.json()) as OhlcvResponse;
  const rows = payload.data?.attributes?.ohlcv_list ?? [];

  return rows
    .map(([timestampSec, open, high, low, close, volumeUsd]) => ({
      timestampSec,
      open,
      high,
      low,
      close,
      volumeUsd,
    }))
    .sort((left, right) => left.timestampSec - right.timestampSec);
}

export async function fetchMarketHistorySnapshot(input: {
  chainId: string;
  poolAddress: string;
  pairCreatedAt?: number;
}): Promise<MarketHistorySnapshot> {
  if (!input.pairCreatedAt) {
    return {
      launchSpikeRatio: null,
      peakToCurrentDrawdown: null,
      historicalWindowHours: null,
      degradedReasons: ["Pool creation time is missing, so launch-history metrics stay limited."],
    };
  }

  const network = GECKO_NETWORKS[input.chainId];
  if (!network) {
    return {
      launchSpikeRatio: null,
      peakToCurrentDrawdown: null,
      historicalWindowHours: null,
      degradedReasons: ["Historical OHLCV is not supported for this chain yet."],
    };
  }

  const createdSec = Math.floor(input.pairCreatedAt / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const ageHours = hoursSince(input.pairCreatedAt);
  const ageDays = Math.max(1, Math.ceil(ageHours / 24));
  const launchWindowEnd = Math.min(nowSec + 3600, createdSec + 7 * 24 * 60 * 60 + 3600);
  const launchWindowHours = Math.max(
    24,
    Math.min(200, Math.ceil((launchWindowEnd - createdSec) / 3600) + 6),
  );
  const dailyLimit = Math.max(3, Math.min(365, ageDays + 3));
  const degradedReasons: string[] = [];

  try {
    const [launchCandlesRaw, lifecycleCandlesRaw] = await Promise.all([
      fetchOhlcv(network, input.poolAddress, "hour", launchWindowEnd, launchWindowHours),
      fetchOhlcv(network, input.poolAddress, "day", nowSec + 24 * 60 * 60, dailyLimit),
    ]);

    const launchCandles = launchCandlesRaw.filter(
      (candle) => candle.timestampSec >= createdSec - 2 * 60 * 60,
    );
    const lifecycleCandles = lifecycleCandlesRaw.filter((candle) => candle.timestampSec >= createdSec);
    const spikeWindowCandles = launchCandles.filter(
      (candle) => candle.timestampSec <= createdSec + 72 * 60 * 60,
    );
    const earlyDailyCandles = lifecycleCandles.filter(
      (candle) => candle.timestampSec <= createdSec + 7 * 24 * 60 * 60,
    );

    let launchSpikeRatio: number | null = null;
    if (spikeWindowCandles.length >= 2) {
      const firstCandle = spikeWindowCandles[0];
      const peakHigh = Math.max(...spikeWindowCandles.map((candle) => candle.high));
      if (firstCandle.open > 0) {
        launchSpikeRatio = peakHigh / firstCandle.open;
      }
    } else if (earlyDailyCandles.length >= 2) {
      const firstDay = earlyDailyCandles[0];
      const peakHigh = Math.max(...earlyDailyCandles.map((candle) => candle.high));
      if (firstDay.open > 0) {
        launchSpikeRatio = peakHigh / firstDay.open;
        degradedReasons.push("Launch spike falls back to daily candles because early hourly trades were sparse.");
      }
    } else {
      degradedReasons.push("Not enough early trading history was available to reconstruct the first launch spike.");
    }

    let peakToCurrentDrawdown: number | null = null;
    if (lifecycleCandles.length >= 2) {
      const peakHigh = Math.max(...lifecycleCandles.map((candle) => candle.high));
      const currentClose = lifecycleCandles[lifecycleCandles.length - 1]?.close ?? 0;
      if (peakHigh > 0 && currentClose >= 0) {
        peakToCurrentDrawdown = Math.max(0, (peakHigh - currentClose) / peakHigh);
      }
    } else {
      degradedReasons.push("Not enough lifecycle history was available to judge drawdown from peak.");
    }

    if (ageDays + 3 > 365) {
      degradedReasons.push("Daily drawdown history is capped to the latest 365 candles.");
    }

    const coveredLifecycleHours =
      lifecycleCandles.length >= 2
        ? (lifecycleCandles[lifecycleCandles.length - 1].timestampSec - lifecycleCandles[0].timestampSec) /
          3600
        : null;

    return {
      launchSpikeRatio:
        launchSpikeRatio === null ? null : Number(launchSpikeRatio.toFixed(2)),
      peakToCurrentDrawdown:
        peakToCurrentDrawdown === null ? null : Number(peakToCurrentDrawdown.toFixed(3)),
      historicalWindowHours:
        coveredLifecycleHours === null ? null : Number(coveredLifecycleHours.toFixed(1)),
      degradedReasons: unique(degradedReasons),
    };
  } catch {
    return {
      launchSpikeRatio: null,
      peakToCurrentDrawdown: null,
      historicalWindowHours: null,
      degradedReasons: ["Historical market lookup failed for this pool."],
    };
  }
}
