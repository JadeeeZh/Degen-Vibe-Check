import {
  AnalyzeResult,
  DetailTone,
  GoPlusIssuerSignals,
  HistoryCategory,
  HistoryConfidence,
  HistoryModule,
  HistoryTone,
  LiquidityLockSignals,
  PairMetrics,
  PostLaunchBehaviorFeatures,
  RugHistoryFeatures,
  ScoreBreakdown,
  ScoreDetail,
  ScoreSection,
  SecurityFlags,
  SignalCallout,
  SignalLevel,
  SocialSignals,
  Verdict,
} from "@/lib/types";
import { HistoryFeaturesResult } from "@/lib/history";
import { clamp, hoursSince, safeRatio } from "@/lib/utils";

function levelFromScore(score: number): SignalLevel {
  if (score >= 75) {
    return "green";
  }

  if (score >= 45) {
    return "yellow";
  }

  return "red";
}

function verdictFromScore(score: number): Verdict {
  if (score >= 80) {
    return "Looks Healthy";
  }

  if (score >= 60) {
    return "Caution";
  }

  return "High Risk";
}

function toneForBoolean(active: boolean, danger = true): SignalLevel | "neutral" {
  if (!active) {
    return "green";
  }

  return danger ? "red" : "yellow";
}

function formatRatio(value: number) {
  return value.toFixed(2);
}

function formatPercentValue(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCount(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function makeCallout(
  title: string,
  detail: string,
  tone: DetailTone,
): SignalCallout {
  return { title, detail, tone };
}

function totalMentions24h(social: SocialSignals) {
  return (social.xMentions24h ?? 0) + (social.farcasterMentions24h ?? 0);
}

function totalMentions7d(social: SocialSignals) {
  return (social.xMentions7d ?? 0) + (social.farcasterMentions7d ?? 0);
}

function socialQualityLabel(quality: SocialSignals["socialQuality"]) {
  if (quality === "organic") {
    return "Organic Build";
  }

  if (quality === "paid_hype") {
    return "Paid Hype";
  }

  if (quality === "muted") {
    return "Quiet";
  }

  if (quality === "overheated") {
    return "Overheated";
  }

  return "Low Conviction";
}

function toneFromScore(score: number): HistoryTone {
  if (score >= 75) {
    return "green";
  }

  if (score >= 45) {
    return "yellow";
  }

  return "red";
}

function labelFromIssuerScore(score: number): string {
  if (score >= 75) {
    return "Clean";
  }

  if (score >= 45) {
    return "Mixed";
  }

  return "Poor";
}

function labelFromDumpScore(score: number): string {
  if (score >= 75) {
    return "Healthy Launch";
  }

  if (score >= 45) {
    return "Mixed";
  }

  return "Dump Pattern Risk";
}

function mergeConfidence(
  left: HistoryConfidence,
  right: HistoryConfidence,
): HistoryConfidence {
  if (left === "low" || right === "low") {
    return "low";
  }

  if (left === "medium" || right === "medium") {
    return "medium";
  }

  return "high";
}

function scoreIssuerReputation(
  features: RugHistoryFeatures,
  security: SecurityFlags,
): number {
  let score = 100;

  if (features.flaggedDeployer) {
    score -= 35;
  }
  if (features.flaggedOwner) {
    score -= 25;
  }
  if (features.priorRugLikeTokenCount !== null) {
    score -= Math.min(features.priorRugLikeTokenCount * 15, 30);
  }
  if (features.priorLpPullCount !== null) {
    score -= Math.min(features.priorLpPullCount * 10, 20);
  }
  if (features.priorPermissionAbuseCount !== null) {
    score -= Math.min(features.priorPermissionAbuseCount * 10, 20);
  }
  if (features.contractSimilarityRisk === "high") {
    score -= 15;
  } else if (features.contractSimilarityRisk === "medium") {
    score -= 8;
  }
  if (features.insiderDumpPattern === "strong") {
    score -= 15;
  } else if (features.insiderDumpPattern === "suspected") {
    score -= 8;
  }
  if ((features.creatorSupplyPct ?? 0) >= 20) {
    score -= 15;
  } else if ((features.creatorSupplyPct ?? 0) >= 10) {
    score -= 8;
  }
  if ((features.ownerSupplyPct ?? 0) >= 15) {
    score -= 15;
  } else if ((features.ownerSupplyPct ?? 0) >= 5) {
    score -= 8;
  }
  if (features.lpLockedPct === null) {
    score -= 8;
  } else if (features.lpLockedPct < 25) {
    score -= 12;
  }
  if (!security.ownerRenounced) {
    score -= 10;
  }
  if (security.proxyUpgradeable) {
    score -= 10;
  }
  if (security.canMint) {
    score -= 10;
  }
  if (security.ownerCanModifyTax) {
    score -= 10;
  }
  if (security.blacklistEnabled || security.tradingPausable) {
    score -= 15;
  }

  return clamp(score, 0, 100);
}

function scoreDumpPattern(features: PostLaunchBehaviorFeatures): number {
  let score = 100;

  if (features.launchSpikeRatio !== null) {
    if (features.launchSpikeRatio > 10) {
      score -= 30;
    } else if (features.launchSpikeRatio > 5) {
      score -= 20;
    } else if (features.launchSpikeRatio > 2) {
      score -= 10;
    }
  }

  if (features.peakToCurrentDrawdown !== null) {
    if (features.peakToCurrentDrawdown > 0.8) {
      score -= 25;
    } else if (features.peakToCurrentDrawdown > 0.6) {
      score -= 20;
    } else if (features.peakToCurrentDrawdown > 0.3) {
      score -= 10;
    }
  }

  if (features.dumpPatternScoreInputs.priceChange24h <= -60) {
    score -= 20;
  } else if (features.dumpPatternScoreInputs.priceChange24h <= -30) {
    score -= 12;
  }

  if (features.dumpPatternScoreInputs.volumeLiquidityRatio > 5) {
    score -= 15;
  } else if (features.dumpPatternScoreInputs.volumeLiquidityRatio > 3) {
    score -= 10;
  }

  if (features.sellPressureImbalance > 2) {
    score -= 15;
  } else if (features.sellPressureImbalance > 1.5) {
    score -= 10;
  }

  if (features.dumpPatternScoreInputs.paidExposure) {
    score -= 15;
  }

  if (features.socialLeadRisk === "high") {
    score -= 20;
  } else if (features.socialLeadRisk === "medium") {
    score -= 10;
  }

  if (features.liquidityStress === "high") {
    score -= 20;
  } else if (features.liquidityStress === "medium") {
    score -= 10;
  }

  return clamp(score, 0, 100);
}

function buildIssuerReputationCategory(
  features: RugHistoryFeatures,
  security: SecurityFlags,
): HistoryCategory {
  const score = scoreIssuerReputation(features, security);
  const tone = toneFromScore(score);
  const bullets: HistoryCategory["bullets"] = [];

  if (features.flaggedDeployer || features.flaggedOwner) {
    bullets.push({
      text:
        features.flaggedDeployer && features.flaggedOwner
          ? "Both deployer and owner wallets hit address-risk checks."
          : features.flaggedDeployer
            ? "The deployer wallet hit an address-risk check."
            : "The owner wallet hit an address-risk check.",
      detail:
        "That usually means this wallet was linked to scam behavior, suspicious contracts, or other abuse signals before. For a retail buyer, it lowers the default trust level immediately.",
      tone: "red",
    });
  } else if (features.maliciousAddressHits === 0) {
    bullets.push({
      text: "Issuer-linked wallets did not hit the current malicious-address checks.",
      detail:
        "This is a positive sign, but it is not a full clean bill of health. It only means the current address-risk source did not flag these wallets.",
      tone: "green",
    });
  }

  if (features.priorTokenCount !== null) {
    bullets.push({
      text:
        features.priorTokenCount > 0
          ? `Recent deployer history shows ${formatCount(features.priorTokenCount)} prior token launches sampled.`
          : "No prior token launches were found in the sampled deployer history.",
      detail:
        features.priorTokenCount > 0
          ? "More prior launches give us a bigger sample of how this deployer behaved before. That history matters more than the current token's marketing alone."
          : "A blank sampled history can be fine, but it also means this deployer may simply be new or outside current explorer coverage.",
      tone: features.priorTokenCount > 0 ? "yellow" : "green",
    });
  }

  if ((features.priorRugLikeTokenCount ?? 0) > 0) {
    bullets.push({
      text: `${formatCount(features.priorRugLikeTokenCount)} prior launches look rug-like from current market and security signals.`,
      detail:
        "If the same deployer already launched tokens that later showed scam-like or collapse-like behavior, the chance of repeating that pattern goes up.",
      tone: (features.priorRugLikeTokenCount ?? 0) >= 2 ? "red" : "yellow",
    });
  }

  if (features.creatorSupplyPct !== null && features.creatorSupplyPct >= 10) {
    bullets.push({
      text: `Creator-linked supply concentration is still ${features.creatorSupplyPct.toFixed(1)}%.`,
      detail:
        "Large creator-held supply means one wallet can still move the market hard. Retail holders are more exposed if that wallet starts selling.",
      tone: features.creatorSupplyPct >= 20 ? "red" : "yellow",
    });
  }
  if (features.ownerSupplyPct !== null && features.ownerSupplyPct >= 5) {
    bullets.push({
      text: `Owner-linked holdings still represent ${features.ownerSupplyPct.toFixed(1)}% of supply.`,
      detail:
        "Meaningful owner allocation keeps power concentrated. Even if the chart looks calm now, exits from that wallet can change the tone fast.",
      tone: features.ownerSupplyPct >= 15 ? "red" : "yellow",
    });
  }
  if (!security.ownerRenounced || security.proxyUpgradeable || security.ownerCanModifyTax) {
    bullets.push({
      text: "Creator or owner-linked control is still present in the contract configuration.",
      detail:
        "In plain English: key settings may still be changeable after you buy. That raises execution risk even when social sentiment looks good.",
      tone: "red",
    });
  }
  if (features.lpLockedPct !== null) {
    bullets.push({
      text: `Observed LP lock sits around ${features.lpLockedPct.toFixed(1)}%.`,
      detail:
        features.lpLockedPct >= 70
          ? "Most of the visible LP appears harder to pull quickly, which reduces one common rug path."
          : features.lpLockedPct >= 25
            ? "Some LP looks locked, but not enough to fully relax. A partial lock still leaves room for pressure."
            : "Little visible LP appears locked, so liquidity can be more fragile if insiders decide to exit.",
      tone: features.lpLockedPct >= 70 ? "green" : features.lpLockedPct >= 25 ? "yellow" : "red",
    });
  }

  for (const reason of features.degradedReasons) {
    if (bullets.length >= 5) {
      break;
    }
    bullets.push({
      text: reason,
      detail: "This is a data-coverage warning, not a clean or risky signal by itself.",
      tone: "neutral",
    });
  }

  return {
    score,
    label: labelFromIssuerScore(score),
    tone,
    summary:
      score >= 75
        ? "Issuer wallets and sampled prior launches look relatively clean so far."
        : score >= 45
          ? "Issuer history looks mixed and still deserves caution."
          : "Issuer-linked history shows a weak trust profile for a retail launch.",
    bullets: bullets.slice(0, 6),
  };
}

function buildDumpPatternCategory(
  features: PostLaunchBehaviorFeatures,
): HistoryCategory {
  const score = scoreDumpPattern(features);
  const tone = toneFromScore(score);
  const bullets: HistoryCategory["bullets"] = [];

  if (features.launchSpikeRatio !== null) {
    bullets.push({
      text: `Price spiked ${features.launchSpikeRatio.toFixed(1)}x after launch.`,
      detail:
        features.launchSpikeRatio > 5
          ? "A huge early spike often means launch buyers chased hard and late buyers were left vulnerable to a sharp unwind."
          : "An early spike is normal for many launches, but the bigger it is, the easier it is for momentum to reverse painfully.",
      tone: features.launchSpikeRatio > 5 ? "red" : "yellow",
    });
  } else {
    bullets.push({
      text: "We could not fully reconstruct the first launch spike from available candles.",
      detail:
        "The app already checks CoinGecko-backed onchain candles here, but some pools still have sparse early trading history. Treat this as unknown, not as safe.",
      tone: "neutral",
    });
  }

  if (features.peakToCurrentDrawdown !== null) {
    bullets.push({
      text: `Price sits ${(features.peakToCurrentDrawdown * 100).toFixed(1)}% below its post-launch peak.`,
      detail:
        features.peakToCurrentDrawdown > 0.8
          ? "That means most of the launch hype has already been given back. Many buyers who chased strength are likely underwater."
          : features.peakToCurrentDrawdown > 0.5
            ? "A deep drawdown means the market already faded a lot of the early excitement. Recovery now needs real demand, not just noise."
            : "A smaller drawdown means price has held onto more of its post-launch gains so far.",
      tone:
        features.peakToCurrentDrawdown > 0.8
          ? "red"
          : features.peakToCurrentDrawdown > 0.5
            ? "yellow"
            : "green",
    });
  }

  bullets.push({
    text: `Sell pressure imbalance is ${features.sellPressureImbalance.toFixed(2)} after launch.`,
    detail:
      features.sellPressureImbalance > 2
        ? "More sell-side pressure than buy-side pressure usually means holders are using strength to exit, not add."
        : features.sellPressureImbalance > 1.5
          ? "Selling is starting to outweigh buying. That can be an early warning before a cleaner breakdown."
          : "Buy and sell flow are still relatively balanced, so exit pressure is not dominating yet.",
    tone:
      features.sellPressureImbalance > 2
        ? "red"
        : features.sellPressureImbalance > 1.5
          ? "yellow"
          : "green",
  });

  bullets.push({
    text: `Liquidity stress currently reads ${features.liquidityStress}.`,
    detail:
      features.liquidityStress === "high"
        ? "Thin or weakly protected liquidity means the chart can drop fast once larger holders sell."
        : features.liquidityStress === "medium"
          ? "Liquidity is not collapsing, but it is not strong enough to fully absorb aggressive exits either."
          : "Liquidity looks solid enough that ordinary trading should move the chart less violently.",
    tone:
      features.liquidityStress === "high"
        ? "red"
        : features.liquidityStress === "medium"
          ? "yellow"
          : "green",
  });

  bullets.push({
    text: `Social lead risk reads ${features.socialLeadRisk}.`,
    detail:
      features.socialLeadRisk === "high"
        ? "This suggests attention may be running ahead of real holding demand. Retail often gets trapped when hype leads but buyers do not stay."
        : features.socialLeadRisk === "medium"
          ? "Social buzz is worth watching because it may be building faster than conviction."
          : "Attention does not currently look far ahead of actual trading participation.",
    tone:
      features.socialLeadRisk === "high"
        ? "red"
        : features.socialLeadRisk === "medium"
          ? "yellow"
          : "green",
  });

  if (features.dumpPatternScoreInputs.paidExposure) {
    bullets.push({
      text: "Paid exposure is present during the current launch phase.",
      detail:
        "Ads and paid pushes can help attention, but they also make it easier to manufacture FOMO before insiders unload.",
      tone: "yellow",
    });
  }

  if (features.historicalWindowHours !== null) {
    bullets.push({
      text: `Historical path covers about ${formatCount(features.historicalWindowHours)} hours of price action.`,
      detail:
        "More covered history means this read is based on a longer real chart, not just the latest 24-hour snapshot.",
      tone: "neutral",
    });
  }

  return {
    score,
    label: labelFromDumpScore(score),
    tone,
    summary:
      score >= 75
        ? "Historical price action does not strongly resemble a dump path yet."
        : score >= 45
          ? "Historical launch behavior looks mixed and should be watched closely."
          : "Historical launch behavior shows several traits that fit a dump pattern.",
    bullets: bullets.slice(0, 6),
  };
}

function buildHistoryModule(
  features: HistoryFeaturesResult,
  security: SecurityFlags,
): HistoryModule {
  const issuerReputation = buildIssuerReputationCategory(features.rugHistory, security);
  const dumpPattern = buildDumpPatternCategory(features.postLaunchBehavior);
  const confidence = mergeConfidence(
    features.rugHistory.confidence,
    features.postLaunchBehavior.confidence,
  );
  const degradedReasons = [
    ...features.rugHistory.degradedReasons,
    ...features.postLaunchBehavior.degradedReasons,
  ].filter((value, index, array) => array.indexOf(value) === index);

  const summary =
    issuerReputation.score <= dumpPattern.score
      ? {
          title:
            issuerReputation.score < 45
              ? "Issuer-linked risk looks elevated"
              : "Issuer-linked trust is still mixed",
          detail: issuerReputation.summary,
          tone: issuerReputation.tone,
        }
      : {
          title:
            dumpPattern.score < 45
              ? "Launch behavior resembles a dump pattern"
              : "Launch behavior still needs caution",
          detail: dumpPattern.summary,
          tone: dumpPattern.tone,
        };

  return {
    summary,
    confidence,
    degradedReasons,
    issuerReputation,
    dumpPattern,
    features,
  };
}

function historyScoreFromModule(history: HistoryModule) {
  return Math.round(history.issuerReputation.score * 0.55 + history.dumpPattern.score * 0.45);
}

function vibeWeightsFromHistoryConfidence(confidence: HistoryConfidence) {
  if (confidence === "high") {
    return {
      liquidity: 0.3,
      contract: 0.3,
      fomo: 0.15,
      history: 0.25,
    };
  }

  if (confidence === "medium") {
    return {
      liquidity: 0.32,
      contract: 0.3,
      fomo: 0.18,
      history: 0.2,
    };
  }

  return {
    liquidity: 0.38,
    contract: 0.37,
    fomo: 0.2,
    history: 0.05,
  };
}

function pickBiggestRisk(input: {
  pair: PairMetrics;
  security: SecurityFlags;
  liquidityLock: LiquidityLockSignals;
  social: SocialSignals;
  pairAgeHours: number;
  volumeLiquidityRatio: number;
  marketCapLiquidityRatio: number;
}): SignalCallout {
  if (input.security.honeypotRisk || input.security.blacklistEnabled) {
    return makeCallout(
      "Sell conditions could change or fail",
      "The scan surfaced a blacklist or honeypot-like restriction, which is the hardest stop for retail exits.",
      "red",
    );
  }

  if (
    !input.security.ownerRenounced ||
    input.security.ownerCanModifyTax ||
    input.security.tradingPausable ||
    input.security.canMint ||
    input.security.proxyUpgradeable
  ) {
    return makeCallout(
      "Owner can still change key behavior",
      "Privileged controls remain active, so trust is not fully minimized after you buy.",
      "red",
    );
  }

  if (
    input.pair.liquidityUsd < 30000 ||
    input.marketCapLiquidityRatio > 50 ||
    input.volumeLiquidityRatio > 5
  ) {
    return makeCallout(
      "Liquidity is thin for the current valuation",
      "Large exits may be difficult because pool depth looks weak relative to valuation or trading pressure.",
      "red",
    );
  }

  if (input.social.socialQuality === "paid_hype") {
    return makeCallout(
      "Hype looks paid, not organic",
      "Attention appears to lean on boosts or paid placements more than broad community discussion.",
      "yellow",
    );
  }

  if (
    input.liquidityLock.lockedLpPercent === null ||
    input.liquidityLock.lockedLpPercent < 25
  ) {
    return makeCallout(
      "LP lock is not verified",
      "Observed LP holder data does not yet show a strong lock signal, so liquidity trust is still limited.",
      "yellow",
    );
  }

  if (input.pairAgeHours < 24) {
    return makeCallout(
      "The main pool is still very new",
      "Fresh pools can reprice violently before a cleaner market structure forms.",
      "yellow",
    );
  }

  return makeCallout(
    "Momentum can still flip quickly",
    "Even cleaner setups can break when liquidity, ownership, or attention changes fast.",
    "yellow",
  );
}

function pickBestSignal(input: {
  pair: PairMetrics;
  security: SecurityFlags;
  liquidityLock: LiquidityLockSignals;
  social: SocialSignals;
  pairAgeHours: number;
}): SignalCallout {
  if (input.pair.liquidityUsd >= 100000) {
    return makeCallout(
      "Deep primary liquidity",
      "The largest pool has enough depth to materially reduce basic slippage risk.",
      "green",
    );
  }

  if (
    !input.security.honeypotRisk &&
    !input.security.blacklistEnabled &&
    !input.security.tradingPausable
  ) {
    return makeCallout(
      "No honeypot or blacklist detected",
      "The scan did not surface the most common hard-stop trading restrictions.",
      "green",
    );
  }

  if (
    input.social.socialQuality === "organic" &&
    input.pair.boostsActive === 0 &&
    input.pair.paidOrderCount === 0
  ) {
    return makeCallout(
      "Attention is rising without paid boosts",
      "Social interest is accelerating while DexScreener paid amplification stays quiet.",
      "green",
    );
  }

  if (
    input.liquidityLock.lockedLpPercent !== null &&
    input.liquidityLock.lockedLpPercent >= 70
  ) {
    return makeCallout(
      "Observed LP looks largely locked",
      "Top LP holder data suggests most visible liquidity is not freely movable.",
      "green",
    );
  }

  if (input.pairAgeHours > 168) {
    return makeCallout(
      "Main pool has survived for a while",
      "The pair has been live for more than a week, which adds a bit of market maturity.",
      "green",
    );
  }

  return makeCallout(
    "Flow is not severely imbalanced",
    "Buy and sell pressure look reasonably balanced instead of one-sided panic.",
    "yellow",
  );
}

function buildLiquidityCard(input: {
  score: number;
  pair: PairMetrics;
  pairAgeHours: number;
  buySellRatio: number;
  volumeLiquidityRatio: number;
  liquidityLock: LiquidityLockSignals;
}): ScoreBreakdown {
  const level = levelFromScore(input.score);
  const details: ScoreDetail[] = [
    {
      label: "Pool size",
      value: `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(input.pair.liquidityUsd)}`,
      tone: input.pair.liquidityUsd >= 100000 ? "green" : input.pair.liquidityUsd >= 30000 ? "yellow" : "red",
    },
    {
      label: "Volume / liquidity",
      value: formatRatio(input.volumeLiquidityRatio),
      tone:
        input.volumeLiquidityRatio >= 0.2 && input.volumeLiquidityRatio <= 3
          ? "green"
          : input.volumeLiquidityRatio >= 0.05 && input.volumeLiquidityRatio <= 5
            ? "yellow"
            : "red",
    },
    {
      label: "LP lock",
      value:
        input.liquidityLock.lockedLpPercent !== null
          ? `${input.liquidityLock.lockedLpPercent.toFixed(1)}% observed locked`
          : input.liquidityLock.lockSummary,
      tone:
        input.liquidityLock.lockedLpPercent === null
          ? "neutral"
          : input.liquidityLock.lockedLpPercent >= 70
            ? "green"
            : input.liquidityLock.lockedLpPercent >= 25
              ? "yellow"
              : "red",
    },
  ];

  return {
    score: input.score,
    level,
    headline:
      level === "green"
        ? "Main pool looks meaningfully deep."
        : level === "yellow"
          ? "Tradable, but depth still needs respect."
          : "Liquidity looks fragile for fast exits.",
    summary:
      level === "green"
        ? "The primary pool has enough depth to reduce basic slippage risk."
        : level === "yellow"
          ? "Execution may be workable, but thin depth or uneven flow still matters."
          : "Thin pool depth or unstable flow can make both entries and exits painful.",
    sections: [
      {
        title: "Basis",
        items: [
          ...details,
          {
            label: "Pair age",
            value: `${input.pairAgeHours.toFixed(1)}h`,
            tone: input.pairAgeHours >= 24 ? "green" : input.pairAgeHours >= 6 ? "yellow" : "red",
          },
          {
            label: "Buy / sell",
            value: formatRatio(input.buySellRatio),
            tone:
              input.buySellRatio >= 0.5 && input.buySellRatio <= 2
                ? "green"
                : input.buySellRatio >= 0.25 && input.buySellRatio <= 4
                  ? "yellow"
                  : "red",
          },
        ],
      },
    ],
  };
}

function buildContractCard(input: {
  score: number;
  security: SecurityFlags;
}): ScoreBreakdown {
  const level = levelFromScore(input.score);
  const riskyFlags = [
    input.security.honeypotRisk && "honeypot",
    input.security.canMint && "mint",
    input.security.blacklistEnabled && "blacklist",
    input.security.tradingPausable && "pause",
    input.security.ownerCanModifyTax && "tax-control",
    input.security.proxyUpgradeable && "upgradeable",
  ].filter(Boolean);

  let callout = "Reminder: no single scan can replace a manual contract review.";
  if (!input.security.supported) {
    callout = "Reminder: this chain lacks security coverage, so treat the score as partial.";
  } else if (input.security.honeypotRisk) {
    callout = "Reminder: honeypot-like behavior is the strongest red flag and should stop the trade.";
  } else if (!input.security.ownerRenounced || input.security.ownerCanModifyTax) {
    callout = "Reminder: active owner powers can change token behavior after you buy.";
  } else if (!input.security.openSource) {
    callout = "Reminder: closed-source contracts deserve extra caution even without obvious exploits.";
  }

  return {
    score: input.score,
    level,
    headline:
      level === "green"
        ? "No dominant sell-blocking risk surfaced."
        : level === "yellow"
          ? "Trust is not fully minimized yet."
          : "Sell conditions or contract control risk look elevated.",
    summary:
      !input.security.supported
        ? "Security coverage is incomplete, so this read stays conservative."
        : riskyFlags.length === 0
          ? "The scan did not surface obvious hard-stop controls as the main story."
          : `Most important flagged controls: ${riskyFlags.join(", ")}.`,
    callout,
    sections: [
      {
        title: "Scan Highlights",
        items: [
          { label: "Sell restriction risk", value: input.security.honeypotRisk ? "Flagged" : "Not flagged", tone: toneForBoolean(input.security.honeypotRisk) },
          { label: "Wallet access can be blocked", value: input.security.blacklistEnabled ? "Yes" : "No", tone: toneForBoolean(input.security.blacklistEnabled) },
          { label: "Trading can be paused", value: input.security.tradingPausable ? "Yes" : "No", tone: toneForBoolean(input.security.tradingPausable) },
          { label: "Sell conditions could change", value: input.security.ownerCanModifyTax ? "Yes" : "No", tone: toneForBoolean(input.security.ownerCanModifyTax, false) },
          { label: "Supply can still expand", value: input.security.canMint ? "Yes" : "No", tone: toneForBoolean(input.security.canMint, false) },
          { label: "Trust is not fully minimized", value: input.security.ownerRenounced ? "No" : "Yes", tone: input.security.ownerRenounced ? "green" : "yellow" },
          { label: "Code transparency is limited", value: input.security.openSource ? "No" : "Yes", tone: input.security.openSource ? "green" : "yellow" },
        ],
      },
    ],
  };
}

function interpretationFromSocialQuality(
  quality: SocialSignals["socialQuality"],
): "Organic Build" | "Quiet" | "Paid Hype" | "Overheated" | "Low Conviction" {
  if (quality === "organic") {
    return "Organic Build";
  }

  if (quality === "paid_hype") {
    return "Paid Hype";
  }

  if (quality === "muted") {
    return "Quiet";
  }

  if (quality === "overheated") {
    return "Overheated";
  }

  return "Low Conviction";
}

function buildFomoCard(input: {
  score: number;
  social: SocialSignals;
  pair: PairMetrics;
  totalTxns: number;
  volumeLiquidityRatio: number;
  interpretation:
    | "Organic Build"
    | "Quiet"
    | "Paid Hype"
    | "Overheated"
    | "Low Conviction";
}): ScoreBreakdown {
  const level = levelFromScore(input.score);
  const combined24h = totalMentions24h(input.social);
  const combined7d = totalMentions7d(input.social);
  const sections: ScoreSection[] = [
    {
      title: "Attention",
      items: [
        {
          label: "X 24h / 7d",
          value: `${formatCount(input.social.xMentions24h)} / ${formatCount(input.social.xMentions7d)}`,
          tone:
            input.social.xMentions24h === null && input.social.xMentions7d === null
              ? "neutral"
              : (input.social.xMentions24h ?? 0) >= 40 || (input.social.xMentions7d ?? 0) >= 120
                ? "yellow"
                : "green",
        },
        {
          label: "Farcaster 24h / 7d",
          value: `${formatCount(input.social.farcasterMentions24h)} / ${formatCount(input.social.farcasterMentions7d)}`,
          tone:
            input.social.farcasterMentions24h === null &&
            input.social.farcasterMentions7d === null
              ? "neutral"
              : (input.social.farcasterMentions24h ?? 0) >= 20 ||
                  (input.social.farcasterMentions7d ?? 0) >= 60
                ? "yellow"
                : "green",
        },
        {
          label: "24h growth",
          value: formatPercentValue(input.social.growth24hPct),
          tone:
            input.social.growth24hPct === null
              ? "neutral"
              : input.social.growth24hPct >= 60
                ? "red"
                : input.social.growth24hPct >= 15
                  ? "green"
                  : "yellow",
        },
        {
          label: "Platform mix",
          value:
            (input.social.xMentions24h ?? 0) > 0 &&
            (input.social.farcasterMentions24h ?? 0) > 0
              ? "X + Farcaster"
              : (input.social.xMentions24h ?? 0) > 0 ||
                  (input.social.farcasterMentions24h ?? 0) > 0
                ? "Single-platform"
                : "Sparse",
          tone:
            (input.social.xMentions24h ?? 0) > 0 &&
            (input.social.farcasterMentions24h ?? 0) > 0
              ? "green"
              : combined24h > 0
                ? "yellow"
                : "neutral",
        },
      ],
    },
    {
      title: "Paid vs Organic",
      items: [
        {
          label: "Boosts / Orders",
          value: `${input.social.boosts ?? 0} / ${input.social.paidOrders ?? 0}`,
          tone:
            (input.social.boosts ?? 0) > 0 || (input.social.paidOrders ?? 0) > 0
              ? "red"
              : "green",
        },
        {
          label: "Attention quality",
          value: socialQualityLabel(input.social.socialQuality),
          tone:
            input.social.socialQuality === "organic"
              ? "green"
              : input.social.socialQuality === "muted"
                ? "neutral"
                : input.social.socialQuality === "mixed"
                  ? "yellow"
                  : "red",
        },
      ],
    },
    {
      title: "On-Chain Hype Proxy",
      items: [
        {
          label: "24h txns",
          value: formatCount(input.totalTxns),
          tone:
            input.totalTxns >= 500 ? "red" : input.totalTxns >= 100 ? "green" : "yellow",
        },
        {
          label: "Vol / liq",
          value: formatRatio(input.volumeLiquidityRatio),
          tone:
            input.volumeLiquidityRatio >= 1.5
              ? "red"
              : input.volumeLiquidityRatio >= 0.2
                ? "green"
                : "yellow",
        },
        {
          label: "Mention conversion",
          value:
            combined24h >= 15 && input.totalTxns < 100
              ? "Weak"
              : combined24h > 0 && input.totalTxns >= 100
                ? "Healthy"
                : "Thin",
          tone:
            combined24h >= 15 && input.totalTxns < 100
              ? "red"
              : combined24h > 0 && input.totalTxns >= 100
                ? "green"
                : "yellow",
        },
      ],
    },
    {
      title: "Interpretation",
      items: [
        {
          label: "State",
          value: input.interpretation,
          tone:
            input.interpretation === "Organic Build"
              ? "green"
              : input.interpretation === "Quiet"
                ? "neutral"
                : input.interpretation === "Low Conviction"
                  ? "yellow"
                  : "red",
        },
        {
          label: "Combined mentions",
          value: `${formatCount(combined24h)} / ${formatCount(combined7d)}`,
          tone:
            combined24h >= 20
              ? "yellow"
              : combined24h > 0
                ? "green"
                : "neutral",
        },
      ],
    },
  ];

  return {
    score: input.score,
    level,
    headline:
      input.interpretation === "Organic Build"
        ? "Attention is rising with better organic quality."
        : input.interpretation === "Paid Hype"
          ? "Attention looks amplified more than earned."
          : input.interpretation === "Overheated"
            ? "Crowding risk is building quickly."
            : input.interpretation === "Quiet"
              ? "Discussion is still relatively muted."
              : "Attention exists, but conviction looks mixed.",
    summary:
      input.social.degradedReasons.length > 0
        ? "Real social coverage is partial, so market-participation proxies are still helping fill gaps."
        : "This blends real mention volume, growth, platform mix, and paid exposure into an attention-quality read.",
    callout:
      input.social.degradedReasons.length > 0
        ? input.social.degradedReasons.join(" · ")
        : undefined,
    sections,
  };
}

export function scoreLiquidity(pair: PairMetrics) {
  const pairAgeHours = hoursSince(pair.pairCreatedAt);
  const volumeLiquidityRatio = safeRatio(pair.volume24h, pair.liquidityUsd);
  const buySellRatio = safeRatio(pair.buys24h, Math.max(pair.sells24h, 1));
  const marketCapLiquidityRatio = safeRatio(
    pair.marketCap || pair.fdv || 0,
    pair.liquidityUsd,
  );

  let score = 0;

  if (pair.liquidityUsd >= 100000) {
    score += 40;
  } else if (pair.liquidityUsd >= 30000) {
    score += 25;
  } else if (pair.liquidityUsd >= 10000) {
    score += 10;
  }

  if (volumeLiquidityRatio >= 0.2 && volumeLiquidityRatio <= 3) {
    score += 20;
  } else if (volumeLiquidityRatio >= 0.05 && volumeLiquidityRatio <= 5) {
    score += 10;
  }

  if (buySellRatio >= 0.5 && buySellRatio <= 2) {
    score += 15;
  } else if (buySellRatio >= 0.25 && buySellRatio <= 4) {
    score += 8;
  }

  if (pairAgeHours >= 24) {
    score += 15;
  } else if (pairAgeHours >= 6) {
    score += 8;
  }

  if (marketCapLiquidityRatio <= 20) {
    score += 10;
  } else if (marketCapLiquidityRatio <= 50) {
    score += 5;
  }

  return {
    score: clamp(score, 0, 100),
    pairAgeHours,
    buySellRatio,
    volumeLiquidityRatio,
  };
}

export function scoreContract(security: SecurityFlags) {
  if (!security.supported) {
    return 55;
  }

  let score = 100;

  if (security.honeypotRisk) {
    score -= 60;
  }
  if (security.canMint) {
    score -= 20;
  }
  if (security.blacklistEnabled) {
    score -= 20;
  }
  if (security.tradingPausable) {
    score -= 20;
  }
  if (security.ownerCanModifyTax) {
    score -= 15;
  }
  if (!security.openSource) {
    score -= 10;
  }
  if (!security.ownerRenounced) {
    score -= 10;
  }
  if (security.proxyUpgradeable) {
    score -= 10;
  }

  return clamp(score, 0, 100);
}

export function scoreFomo(
  pair: PairMetrics,
  liquiditySignals: { pairAgeHours: number; volumeLiquidityRatio: number },
  social: SocialSignals,
) {
  let score = 25;
  const totalTxns = pair.buys24h + pair.sells24h;
  const mentions24h = totalMentions24h(social);
  const mentions7d = totalMentions7d(social);
  const crossPlatform =
    (social.xMentions24h ?? 0) > 0 && (social.farcasterMentions24h ?? 0) > 0;
  const paidExposure = (social.boosts ?? 0) > 0 || (social.paidOrders ?? 0) > 0;
  const weakConversion = mentions24h >= 15 && totalTxns < 100;

  if (mentions24h >= 40) {
    score += 20;
  } else if (mentions24h >= 10) {
    score += 12;
  } else if (mentions24h >= 3) {
    score += 6;
  }

  if (mentions7d >= 120) {
    score += 10;
  } else if (mentions7d >= 30) {
    score += 5;
  }

  if ((social.growth24hPct ?? 0) >= 50) {
    score += 15;
  } else if ((social.growth24hPct ?? 0) >= 15) {
    score += 8;
  }

  if (crossPlatform) {
    score += 10;
  }

  if (totalTxns >= 500) {
    score += 10;
  } else if (totalTxns >= 100) {
    score += 5;
  }

  if (liquiditySignals.volumeLiquidityRatio >= 0.2 && liquiditySignals.volumeLiquidityRatio <= 2) {
    score += 10;
  } else if (liquiditySignals.volumeLiquidityRatio > 4) {
    score -= 10;
  }

  if (liquiditySignals.pairAgeHours < 24) {
    score += 5;
  }

  if (paidExposure) {
    score -= 20;
  }

  if (weakConversion) {
    score -= 20;
  }

  if (social.socialQuality === "organic") {
    score += 10;
  } else if (social.socialQuality === "overheated") {
    score -= 10;
  } else if (social.socialQuality === "paid_hype") {
    score -= 15;
  } else if (social.socialQuality === "muted") {
    score -= 5;
  }

  return clamp(score, 0, 100);
}

export function buildAnalyzeResult(
  pair: PairMetrics,
  security: SecurityFlags,
  issuerSignals: GoPlusIssuerSignals,
  liquidityLock: LiquidityLockSignals,
  social: SocialSignals,
  historyFeatures: HistoryFeaturesResult,
): AnalyzeResult {
  const liquiditySignals = scoreLiquidity(pair);
  const contractScore = scoreContract(security);
  const totalTxns24h = pair.buys24h + pair.sells24h;
  const marketCapLiquidityRatio = safeRatio(pair.marketCap || pair.fdv || 0, pair.liquidityUsd);
  const fomoScore = scoreFomo(pair, liquiditySignals, social);
  const fomoInterpretation = interpretationFromSocialQuality(social.socialQuality);
  const history = buildHistoryModule(historyFeatures, security);
  const historyScore = historyScoreFromModule(history);
  const weights = vibeWeightsFromHistoryConfidence(history.confidence);
  const vibeScore = Math.round(
    liquiditySignals.score * weights.liquidity +
      contractScore * weights.contract +
      fomoScore * weights.fomo +
      historyScore * weights.history,
  );
  const verdict = verdictFromScore(vibeScore);

  const riskWhy: string[] = [];
  const positiveWhy: string[] = [];

  if (pair.liquidityUsd >= 100000) {
    positiveWhy.push("Primary pool liquidity is above $100k, which helps reduce slippage for normal-sized exits.");
  } else if (pair.liquidityUsd < 10000) {
    riskWhy.push("Primary pool liquidity is thin, so large exits may be difficult.");
  }

  if (security.honeypotRisk || security.blacklistEnabled || security.tradingPausable) {
    riskWhy.push("Sell conditions could change because the contract still shows hard-stop control risk.");
  }

  if (
    security.canMint ||
    security.ownerCanModifyTax ||
    security.tradingPausable ||
    !security.ownerRenounced ||
    security.proxyUpgradeable
  ) {
    riskWhy.push("Owner control is still present, so key token behavior may not be fully minimized.");
  } else if (security.supported) {
    positiveWhy.push("The scan did not surface a dominant honeypot, blacklist, or pause risk.");
  }

  if (social.socialQuality === "paid_hype") {
    riskWhy.push("Attention appears to be leaning on boosts or paid placements more than organic discussion.");
  } else if (social.socialQuality === "organic") {
    positiveWhy.push("Attention is rising across real discussion channels without obvious paid amplification dominating the picture.");
  }

  if (liquidityLock.lockedLpPercent !== null) {
    if (liquidityLock.lockedLpPercent >= 70) {
      positiveWhy.push("Top LP holder data suggests most observed liquidity is locked.");
    } else if (liquidityLock.lockedLpPercent < 25) {
      riskWhy.push("LP lock is not clearly verified from the observed holder data.");
    }
  } else {
    riskWhy.push("LP lock could not be verified from available security data.");
  }

  if (social.degradedReasons.length > 0) {
    riskWhy.push(social.degradedReasons[0]);
  } else if (totalMentions24h(social) > 30 && social.socialQuality === "overheated") {
    riskWhy.push("Discussion and trading activity are accelerating fast enough to increase overheating risk.");
  } else if (totalMentions24h(social) > 10 && social.socialQuality === "organic") {
    positiveWhy.push("X and Farcaster both show live discussion, which improves attention quality.");
  }

  if (history.summary.tone === "red" || history.summary.tone === "yellow") {
    riskWhy.push(history.summary.detail);
  } else {
    positiveWhy.push(history.summary.detail);
  }

  if (history.confidence === "high") {
    positiveWhy.push("History now carries meaningful weight in the Vibe Score because issuer and launch-path evidence is relatively complete.");
  } else if (history.confidence === "medium") {
    positiveWhy.push("History is now part of the Vibe Score, but it still uses a moderate weight because some issuer or chart history remains partial.");
  } else {
    riskWhy.push("History is now included in the Vibe Score, but only lightly because the available issuer or launch history is still thin.");
  }

  if (liquiditySignals.pairAgeHours < 24) {
    riskWhy.push("The main pool is still very young, which raises volatility risk.");
  } else if (liquiditySignals.pairAgeHours > 168) {
    positiveWhy.push("The main pool has survived more than a week, adding some maturity.");
  }

  const why = [...riskWhy, ...positiveWhy];

  if (why.length < 3) {
    why.push("Buy and sell flow is being used as a lightweight proxy for crowd balance.");
  }

  return {
    token: {
      address: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      chainId: pair.chainId,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      quoteSymbol: pair.quoteToken.symbol,
    },
    verdict,
    vibeScore,
    biggestRisk: pickBiggestRisk({
      pair,
      security,
      liquidityLock,
      social,
      pairAgeHours: liquiditySignals.pairAgeHours,
      volumeLiquidityRatio: liquiditySignals.volumeLiquidityRatio,
      marketCapLiquidityRatio,
    }),
    bestSignal: pickBestSignal({
      pair,
      security,
      liquidityLock,
      social,
      pairAgeHours: liquiditySignals.pairAgeHours,
    }),
    why: why.slice(0, 5),
    cards: {
      liquidity: buildLiquidityCard({
        score: liquiditySignals.score,
        pair,
        pairAgeHours: liquiditySignals.pairAgeHours,
        buySellRatio: liquiditySignals.buySellRatio,
        volumeLiquidityRatio: liquiditySignals.volumeLiquidityRatio,
        liquidityLock,
      }),
      contract: buildContractCard({
        score: contractScore,
        security,
      }),
      fomo: buildFomoCard({
        score: fomoScore,
        social,
        pair,
        totalTxns: totalTxns24h,
        volumeLiquidityRatio: liquiditySignals.volumeLiquidityRatio,
        interpretation: fomoInterpretation,
      }),
    },
    metrics: {
      liquidityUsd: pair.liquidityUsd,
      volume24h: pair.volume24h,
      priceChange24h: pair.priceChange24h,
      buys24h: pair.buys24h,
      sells24h: pair.sells24h,
      pairAgeHours: liquiditySignals.pairAgeHours,
      marketCap: pair.marketCap,
      fdv: pair.fdv,
      boostsActive: pair.boostsActive,
      paidOrderCount: pair.paidOrderCount,
      totalTxns24h,
      buySellRatio: liquiditySignals.buySellRatio,
      volumeLiquidityRatio: liquiditySignals.volumeLiquidityRatio,
    },
    security,
    issuerSignals,
    liquidityLock,
    social,
    history,
    fomoInterpretation,
    links: {
      dexScreener: pair.url,
    },
    fetchedAt: new Date().toISOString(),
  };
}
