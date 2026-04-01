import { searchBestTokenPair } from "@/lib/dexscreener";
import { fetchGoPlusSignals } from "@/lib/goplus";
import { analyzeHistory } from "@/lib/history";
import { buildAnalyzeResult } from "@/lib/scoring";
import { fetchSocialSignals } from "@/lib/social";

export async function analyzeToken(query: string) {
  const pair = await searchBestTokenPair(query);
  const totalTxns24h = pair.buys24h + pair.sells24h;
  const volumeLiquidityRatio = pair.volume24h / Math.max(pair.liquidityUsd, 1);
  const [{ security, liquidityLock, issuerSignals }, social] = await Promise.all([
    fetchGoPlusSignals(pair.chainId, pair.baseToken.address),
    fetchSocialSignals({
      address: pair.baseToken.address,
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      chainId: pair.chainId,
      boosts: pair.boostsActive,
      paidOrders: pair.paidOrderCount,
      totalTxns24h,
      volumeLiquidityRatio,
    }),
  ]);

  const historyFeatures = await analyzeHistory({
    pair,
    security,
    issuerSignals,
    liquidityLock,
    social,
  });

  return buildAnalyzeResult(
    pair,
    security,
    issuerSignals,
    liquidityLock,
    social,
    historyFeatures,
  );
}
