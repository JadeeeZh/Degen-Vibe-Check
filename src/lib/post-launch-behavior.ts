import { fetchMarketHistorySnapshot } from "@/lib/market-history";
import { LiquidityLockSignals, PostLaunchBehaviorFeatures, SocialSignals } from "@/lib/types";
import { hoursSince, safeRatio } from "@/lib/utils";

type DerivePostLaunchBehaviorInput = {
  chainId: string;
  pairAddress: string;
  pairCreatedAt?: number;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number;
  buys24h: number;
  sells24h: number;
  paidExposure: boolean;
  social: SocialSignals;
  liquidityLock: LiquidityLockSignals;
};

export async function derivePostLaunchBehaviorFeatures(
  input: DerivePostLaunchBehaviorInput,
): Promise<PostLaunchBehaviorFeatures> {
  const launchAgeHours = hoursSince(input.pairCreatedAt);
  const volumeLiquidityRatio = safeRatio(input.volume24h, input.liquidityUsd);
  const sellPressureImbalance = safeRatio(input.sells24h, Math.max(input.buys24h, 1));
  const weakConversion =
    ((input.social.xMentions24h ?? 0) + (input.social.farcasterMentions24h ?? 0)) >= 15 &&
    input.buys24h + input.sells24h < 100;

  let liquidityStress: "low" | "medium" | "high" = "low";
  if (
    input.liquidityUsd < 30000 ||
    input.liquidityLock.lockedLpPercent === null ||
    (input.liquidityLock.lockedLpPercent ?? 0) < 25
  ) {
    liquidityStress = "medium";
  }
  if (
    input.liquidityUsd < 10000 ||
    volumeLiquidityRatio > 5 ||
    (input.liquidityLock.lockedLpPercent ?? 100) < 10
  ) {
    liquidityStress = "high";
  }

  let socialLeadRisk: "low" | "medium" | "high" = "low";
  if ((input.social.growth24hPct ?? 0) >= 20 || input.social.socialQuality === "mixed") {
    socialLeadRisk = "medium";
  }
  if (
    input.social.socialQuality === "paid_hype" ||
    input.social.socialQuality === "overheated" ||
    weakConversion
  ) {
    socialLeadRisk = "high";
  }

  const marketHistory = await fetchMarketHistorySnapshot({
    chainId: input.chainId,
    poolAddress: input.pairAddress,
    pairCreatedAt: input.pairCreatedAt,
  });

  return {
    launchAgeHours,
    launchSpikeRatio: marketHistory.launchSpikeRatio,
    peakToCurrentDrawdown: marketHistory.peakToCurrentDrawdown,
    liquidityDrainRatio: null,
    liquidityStress,
    sellPressureImbalance,
    socialLeadRisk,
    dumpPatternScoreInputs: {
      priceChange24h: input.priceChange24h,
      volumeLiquidityRatio,
      totalTxns24h: input.buys24h + input.sells24h,
      paidExposure: input.paidExposure,
      socialGrowth24hPct: input.social.growth24hPct,
    },
    historicalWindowHours: marketHistory.historicalWindowHours,
    confidence:
      marketHistory.launchSpikeRatio !== null && marketHistory.peakToCurrentDrawdown !== null
        ? "high"
        : launchAgeHours >= 24
          ? "medium"
          : "low",
    degradedReasons: marketHistory.degradedReasons,
  };
}
