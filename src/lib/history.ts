import {
  GoPlusIssuerSignals,
  LiquidityLockSignals,
  PostLaunchBehaviorFeatures,
  RugHistoryFeatures,
  SecurityFlags,
  SocialSignals,
} from "@/lib/types";
import { deriveIssuerReputationFeatures } from "@/lib/issuer-reputation";
import { derivePostLaunchBehaviorFeatures } from "@/lib/post-launch-behavior";

type AnalyzeHistoryInput = {
  pair: {
    chainId: string;
    pairAddress: string;
    baseToken: {
      address: string;
    };
    pairCreatedAt?: number;
    liquidityUsd: number;
    volume24h: number;
    priceChange24h: number;
    buys24h: number;
    sells24h: number;
    boostsActive: number;
    paidOrderCount: number;
  };
  security: SecurityFlags;
  issuerSignals: GoPlusIssuerSignals;
  liquidityLock: LiquidityLockSignals;
  social: SocialSignals;
};

export type HistoryFeaturesResult = {
  rugHistory: RugHistoryFeatures;
  postLaunchBehavior: PostLaunchBehaviorFeatures;
};

export async function analyzeHistory(input: AnalyzeHistoryInput): Promise<HistoryFeaturesResult> {
  const [rugHistory, postLaunchBehavior] = await Promise.all([
    deriveIssuerReputationFeatures({
      chainId: input.pair.chainId,
      tokenAddress: input.pair.baseToken.address,
      issuerSignals: input.issuerSignals,
      security: input.security,
      liquidityLock: input.liquidityLock,
    }),
    derivePostLaunchBehaviorFeatures({
      chainId: input.pair.chainId,
      pairAddress: input.pair.pairAddress,
      pairCreatedAt: input.pair.pairCreatedAt,
      liquidityUsd: input.pair.liquidityUsd,
      volume24h: input.pair.volume24h,
      priceChange24h: input.pair.priceChange24h,
      buys24h: input.pair.buys24h,
      sells24h: input.pair.sells24h,
      paidExposure: input.pair.boostsActive > 0 || input.pair.paidOrderCount > 0,
      social: input.social,
      liquidityLock: input.liquidityLock,
    }),
  ]);

  return {
    rugHistory,
    postLaunchBehavior,
  };
}
