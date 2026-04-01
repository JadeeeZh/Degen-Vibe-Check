export type Verdict = "Looks Healthy" | "Caution" | "High Risk";

export type SignalLevel = "green" | "yellow" | "red";

export type DetailTone = SignalLevel | "neutral";

export type ScoreDetail = {
  label: string;
  value: string;
  tone?: DetailTone;
};

export type ScoreSection = {
  title: string;
  items: ScoreDetail[];
};

export type SignalCallout = {
  title: string;
  detail: string;
  tone: DetailTone;
};

export type ScoreBreakdown = {
  score: number;
  level: SignalLevel;
  headline: string;
  summary: string;
  callout?: string;
  sections?: ScoreSection[];
};

export type PairMetrics = {
  chainId: string;
  dexId: string;
  pairAddress: string;
  url?: string;
  pairCreatedAt?: number;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number;
  buys24h: number;
  sells24h: number;
  marketCap: number;
  fdv: number;
  labels: string[];
  boostsActive: number;
  paidOrderCount: number;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
};

export type SecurityFlags = {
  supported: boolean;
  canMint: boolean;
  blacklistEnabled: boolean;
  whitelistEnabled: boolean;
  tradingPausable: boolean;
  ownerCanModifyTax: boolean;
  honeypotRisk: boolean;
  proxyUpgradeable: boolean;
  openSource: boolean;
  ownerRenounced: boolean;
};

export type LiquidityLockSignals = {
  supported: boolean;
  lockedLpPercent: number | null;
  unlockedTopLpPercent: number | null;
  lockSummary: string;
};

export type GoPlusIssuerSignals = {
  supported: boolean;
  deployerAddress: string | null;
  ownerAddress: string | null;
  relatedAddresses: string[];
  creatorPercent: number | null;
  ownerPercent: number | null;
  holderCount: number | null;
  topHolderPercent: number | null;
  hiddenOwner: boolean;
};

export type HistoryConfidence = "low" | "medium" | "high";

export type SimilarityRisk = "low" | "medium" | "high" | "unknown";

export type InsiderDumpPattern = "none" | "suspected" | "strong" | "unknown";

export type HistoryTone = "green" | "yellow" | "red" | "neutral";

export type HistoryBullet = {
  text: string;
  detail?: string;
  tone: HistoryTone;
};

export type RugHistoryFeatures = {
  deployerAddress: string | null;
  ownerAddress: string | null;
  relatedAddresses: string[];
  priorTokenCount: number | null;
  priorHighRiskTokenCount: number | null;
  priorRugLikeTokenCount: number | null;
  priorAbandonedTokenCount: number | null;
  maliciousAddressHits: number | null;
  flaggedDeployer: boolean | null;
  flaggedOwner: boolean | null;
  priorLpPullCount: number | null;
  priorFastLiquidityCollapseCount: number | null;
  priorPermissionAbuseCount: number | null;
  priorFakeRenouncePatternCount: number | null;
  contractSimilarityRisk: SimilarityRisk;
  insiderDumpPattern: InsiderDumpPattern;
  creatorSupplyPct: number | null;
  ownerSupplyPct: number | null;
  lpLockedPct: number | null;
  confidence: HistoryConfidence;
  degradedReasons: string[];
};

export type PostLaunchBehaviorFeatures = {
  launchAgeHours: number;
  launchSpikeRatio: number | null;
  peakToCurrentDrawdown: number | null;
  liquidityDrainRatio: number | null;
  liquidityStress: "low" | "medium" | "high";
  sellPressureImbalance: number;
  socialLeadRisk: "low" | "medium" | "high";
  dumpPatternScoreInputs: {
    priceChange24h: number;
    volumeLiquidityRatio: number;
    totalTxns24h: number;
    paidExposure: boolean;
    socialGrowth24hPct: number | null;
  };
  historicalWindowHours: number | null;
  confidence: HistoryConfidence;
  degradedReasons: string[];
};

export type HistoryCategory = {
  score: number;
  label: string;
  tone: HistoryTone;
  summary: string;
  bullets: HistoryBullet[];
};

export type HistorySummary = {
  title: string;
  detail: string;
  tone: HistoryTone;
};

export type HistoryModule = {
  summary: HistorySummary;
  confidence: HistoryConfidence;
  degradedReasons: string[];
  issuerReputation: HistoryCategory;
  dumpPattern: HistoryCategory;
  features: {
    rugHistory: RugHistoryFeatures;
    postLaunchBehavior: PostLaunchBehaviorFeatures;
  };
};

export type SocialQuality =
  | "organic"
  | "paid_hype"
  | "muted"
  | "mixed"
  | "overheated";

export type SocialSignals = {
  available: boolean;
  xMentions24h: number | null;
  xMentions7d: number | null;
  farcasterMentions24h: number | null;
  farcasterMentions7d: number | null;
  growth24hPct: number | null;
  boosts: number | null;
  paidOrders: number | null;
  socialQuality: SocialQuality;
  degradedReasons: string[];
};

export type AnalyzeResult = {
  token: {
    address: string;
    name: string;
    symbol: string;
    chainId: string;
    dexId: string;
    pairAddress: string;
    quoteSymbol: string;
  };
  verdict: Verdict;
  vibeScore: number;
  biggestRisk: SignalCallout;
  bestSignal: SignalCallout;
  why: string[];
  cards: {
    liquidity: ScoreBreakdown;
    contract: ScoreBreakdown;
    fomo: ScoreBreakdown;
  };
  metrics: {
    liquidityUsd: number;
    volume24h: number;
    priceChange24h: number;
    buys24h: number;
    sells24h: number;
    pairAgeHours: number;
    marketCap: number;
    fdv: number;
    boostsActive: number;
    paidOrderCount: number;
    totalTxns24h: number;
    buySellRatio: number;
    volumeLiquidityRatio: number;
  };
  security: SecurityFlags;
  issuerSignals: GoPlusIssuerSignals;
  liquidityLock: LiquidityLockSignals;
  social: SocialSignals;
  history: HistoryModule;
  fomoInterpretation:
    | "Organic Build"
    | "Quiet"
    | "Paid Hype"
    | "Overheated"
    | "Low Conviction";
  links: {
    dexScreener?: string;
  };
  fetchedAt: string;
};
