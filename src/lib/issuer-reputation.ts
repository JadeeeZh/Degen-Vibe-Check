import { fetchBestPairForToken } from "@/lib/dexscreener";
import { fetchGoPlusSignals, resolveGoPlusChainId } from "@/lib/goplus";
import {
  GoPlusIssuerSignals,
  HistoryConfidence,
  LiquidityLockSignals,
  RugHistoryFeatures,
  SecurityFlags,
} from "@/lib/types";
import { hoursSince, toBooleanFlag } from "@/lib/utils";

type DeriveIssuerReputationInput = {
  chainId: string;
  tokenAddress: string;
  issuerSignals: GoPlusIssuerSignals;
  security: SecurityFlags;
  liquidityLock: LiquidityLockSignals;
};

type GoPlusAddressSecurityRecord = Record<string, unknown>;

type GoPlusAddressSecurityResponse = {
  result?: GoPlusAddressSecurityRecord;
};

type AddressRiskSummary = {
  flagged: boolean | null;
  maliciousContractsCreated: number | null;
  degradedReasons: string[];
};

type BlockscoutTransaction = {
  created_contract?: {
    hash?: string;
  } | null;
};

type BlockscoutResponse = {
  items?: BlockscoutTransaction[];
  next_page_params?: Record<string, string | number> | null;
};

type PriorLaunchSummary = {
  priorTokenCount: number | null;
  priorHighRiskTokenCount: number | null;
  priorRugLikeTokenCount: number | null;
  priorAbandonedTokenCount: number | null;
  priorLpPullCount: number | null;
  priorFastLiquidityCollapseCount: number | null;
  priorPermissionAbuseCount: number | null;
  priorFakeRenouncePatternCount: number | null;
  degradedReasons: string[];
  confidence: HistoryConfidence;
};

const BLOCKSCOUT_API_BASES: Record<string, string> = {
  ethereum: "https://eth.blockscout.com/api/v2",
  base: "https://base.blockscout.com/api/v2",
  optimism: "https://optimism.blockscout.com/api/v2",
  arbitrum: "https://arbitrum.blockscout.com/api/v2",
  polygon: "https://polygon.blockscout.com/api/v2",
  gnosis: "https://gnosis.blockscout.com/api/v2",
  linea: "https://linea.blockscout.com/api/v2",
  scroll: "https://scroll.blockscout.com/api/v2",
};

const DEFAULT_BLOCKSCOUT_PAGES = 3;
const DEFAULT_PRIOR_LAUNCH_SAMPLE_LIMIT = 5;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function unique<T>(values: T[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function normalizeAddress(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.toLowerCase() === ZERO_ADDRESS ? null : value;
}

async function fetchAddressRiskSummary(
  chainId: string,
  address: string | null,
): Promise<AddressRiskSummary> {
  if (!address) {
    return {
      flagged: null,
      maliciousContractsCreated: null,
      degradedReasons: [],
    };
  }

  const goplusChainId = resolveGoPlusChainId(chainId);
  if (!goplusChainId) {
    return {
      flagged: null,
      maliciousContractsCreated: null,
      degradedReasons: ["Address security API is not supported on this chain."],
    };
  }

  const accessToken = process.env.GOPLUS_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      flagged: null,
      maliciousContractsCreated: null,
      degradedReasons: ["Set GOPLUS_ACCESS_TOKEN to enable malicious-address checks."],
    };
  }

  try {
    const response = await fetch(
      `https://api.gopluslabs.io/api/v1/address_security/${address}?chain_id=${goplusChainId}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GoPlus address security failed: ${response.status}`);
    }

    const payload = (await response.json()) as GoPlusAddressSecurityResponse;
    const result = payload.result ?? {};
    const behaviorFlags = [
      result.doubt_list,
      result.blacklist_doubt,
      result.honeypot_related_address,
      result.phishing_activities,
      result.blackmail_activities,
      result.stealing_attack,
      result.fake_kyc,
      result.malicious_mining_activities,
      result.darkweb_transactions,
      result.cybercrime,
      result.money_laundering,
      result.financial_crime,
      result.mixer,
      result.sanctioned,
      result.gas_abuse,
      result.reinit,
      result.fake_standard_interface,
    ];
    const maliciousContractsCreated = parseNumber(result.number_of_malicious_contracts_created);
    const flagged =
      behaviorFlags.some((value) => toBooleanFlag(value)) || (maliciousContractsCreated ?? 0) > 0;

    return {
      flagged,
      maliciousContractsCreated,
      degradedReasons: [],
    };
  } catch {
    return {
      flagged: null,
      maliciousContractsCreated: null,
      degradedReasons: ["Malicious-address lookup failed for one issuer wallet."],
    };
  }
}

async function fetchRecentCreatedContracts(
  chainId: string,
  creatorAddress: string | null,
  currentTokenAddress: string,
) {
  if (!creatorAddress) {
    return {
      addresses: [] as string[],
      degradedReasons: [] as string[],
      truncated: false,
    };
  }

  const blockscoutBase = BLOCKSCOUT_API_BASES[chainId];
  if (!blockscoutBase) {
    return {
      addresses: [] as string[],
      degradedReasons: ["Prior-launch explorer history is not supported on this chain."],
      truncated: false,
    };
  }

  const maxPages = parsePositiveInteger(process.env.BLOCKSCOUT_MAX_PAGES, DEFAULT_BLOCKSCOUT_PAGES);
  const sampleLimit = parsePositiveInteger(
    process.env.PRIOR_LAUNCH_SAMPLE_LIMIT,
    DEFAULT_PRIOR_LAUNCH_SAMPLE_LIMIT,
  );
  const addresses: string[] = [];
  let nextPageParams: Record<string, string | number> | null = null;
  let truncated = false;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const query = new URLSearchParams();
    if (nextPageParams) {
      Object.entries(nextPageParams).forEach(([key, value]) => {
        query.set(key, String(value));
      });
    }

    const response = await fetch(
      `${blockscoutBase}/addresses/${creatorAddress}/transactions${query.size ? `?${query}` : ""}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Blockscout failed: ${response.status}`);
    }

    const payload = (await response.json()) as BlockscoutResponse;
    for (const item of payload.items ?? []) {
      const createdAddress = item.created_contract?.hash;
      if (
        typeof createdAddress === "string" &&
        createdAddress.toLowerCase() !== currentTokenAddress.toLowerCase()
      ) {
        addresses.push(createdAddress);
      }
    }

    if (addresses.length >= sampleLimit) {
      truncated = true;
      break;
    }

    if (!payload.next_page_params) {
      nextPageParams = null;
      break;
    }

    nextPageParams = payload.next_page_params;
  }

  return {
    addresses: unique(addresses).slice(0, sampleLimit),
    degradedReasons: truncated
      ? ["Prior launches are sampled from recent deployments, not full issuer history."]
      : [],
    truncated,
  };
}

async function classifyPriorLaunches(
  chainId: string,
  createdContracts: string[],
): Promise<PriorLaunchSummary> {
  if (createdContracts.length === 0) {
    return {
      priorTokenCount: 0,
      priorHighRiskTokenCount: 0,
      priorRugLikeTokenCount: 0,
      priorAbandonedTokenCount: 0,
      priorLpPullCount: 0,
      priorFastLiquidityCollapseCount: 0,
      priorPermissionAbuseCount: 0,
      priorFakeRenouncePatternCount: 0,
      degradedReasons: [],
      confidence: "medium",
    };
  }

  const inspections = await Promise.all(
    createdContracts.map(async (address) => {
      try {
        const [pair, goplus] = await Promise.all([
          fetchBestPairForToken(chainId, address).catch(() => null),
          fetchGoPlusSignals(chainId, address).catch(() => null),
        ]);

        const security = goplus?.security;
        const liquidityLock = goplus?.liquidityLock;
        const issuerSignals = goplus?.issuerSignals;
        const ageHours = pair ? hoursSince(pair.pairCreatedAt) : 0;
        const tokenLike = Boolean(pair) || Boolean(security?.supported);
        const permissionAbuse = Boolean(
          security &&
            (security.canMint ||
              security.ownerCanModifyTax ||
              security.tradingPausable ||
              security.blacklistEnabled),
        );
        const weakLiquidity = !pair || pair.liquidityUsd < 5000;
        const sharpCrash = Boolean(pair && pair.priceChange24h <= -65);
        const rugLike = Boolean(
          tokenLike &&
            ((security?.honeypotRisk ?? false) ||
              (security?.blacklistEnabled ?? false) ||
              (sharpCrash && weakLiquidity) ||
              ((liquidityLock?.lockedLpPercent ?? 100) < 10 && weakLiquidity)),
        );
        const abandoned = Boolean(
          tokenLike &&
            ((!pair && security?.supported) ||
              (pair && ageHours >= 72 && pair.liquidityUsd < 3000 && pair.volume24h < 1000)),
        );
        const lpPull = Boolean(
          pair &&
            pair.liquidityUsd < 1500 &&
            (liquidityLock?.lockedLpPercent === null ||
              (liquidityLock?.lockedLpPercent ?? 100) < 10),
        );
        const fastLiquidityCollapse = Boolean(pair && sharpCrash && pair.liquidityUsd < 5000);
        const fakeRenouncePattern = Boolean(
          security?.ownerRenounced && issuerSignals?.hiddenOwner,
        );

        return {
          tokenLike,
          highRisk: rugLike || permissionAbuse,
          rugLike,
          abandoned,
          lpPull,
          fastLiquidityCollapse,
          permissionAbuse,
          fakeRenouncePattern,
        };
      } catch {
        return null;
      }
    }),
  );

  const launches = inspections.filter(
    (value): value is NonNullable<typeof value> => Boolean(value?.tokenLike),
  );
  const failedCount = inspections.filter((value) => value === null).length;

  return {
    priorTokenCount: launches.length,
    priorHighRiskTokenCount: launches.filter((item) => item.highRisk).length,
    priorRugLikeTokenCount: launches.filter((item) => item.rugLike).length,
    priorAbandonedTokenCount: launches.filter((item) => item.abandoned).length,
    priorLpPullCount: launches.filter((item) => item.lpPull).length,
    priorFastLiquidityCollapseCount: launches.filter((item) => item.fastLiquidityCollapse).length,
    priorPermissionAbuseCount: launches.filter((item) => item.permissionAbuse).length,
    priorFakeRenouncePatternCount: launches.filter((item) => item.fakeRenouncePattern).length,
    degradedReasons:
      failedCount > 0
        ? ["Some prior launches could not be classified from current market data."]
        : [],
    confidence: launches.length >= 2 ? "high" : "medium",
  };
}

export async function deriveIssuerReputationFeatures(
  input: DeriveIssuerReputationInput,
): Promise<RugHistoryFeatures> {
  const deployerAddress = normalizeAddress(input.issuerSignals.deployerAddress);
  const ownerAddress = normalizeAddress(input.issuerSignals.ownerAddress);
  const concentrationRisk =
    (input.issuerSignals.creatorPercent ?? 0) >= 20 ||
    (input.issuerSignals.ownerPercent ?? 0) >= 20;
  const moderateConcentrationRisk =
    (input.issuerSignals.creatorPercent ?? 0) >= 10 ||
    (input.issuerSignals.ownerPercent ?? 0) >= 10;

  const [deployerRisk, ownerRisk, recentContractsResult] = await Promise.all([
    fetchAddressRiskSummary(input.chainId, deployerAddress),
    deployerAddress === ownerAddress
      ? Promise.resolve({
          flagged: null,
          maliciousContractsCreated: null,
          degradedReasons: [],
        } satisfies AddressRiskSummary)
      : fetchAddressRiskSummary(input.chainId, ownerAddress),
    fetchRecentCreatedContracts(input.chainId, deployerAddress, input.tokenAddress).catch(() => ({
      addresses: [] as string[],
      degradedReasons: ["Prior-launch explorer lookup failed for the deployer address."],
      truncated: false,
    })),
  ]);

  const priorLaunches = await classifyPriorLaunches(input.chainId, recentContractsResult.addresses);
  const priorHighRiskTokenCount = Math.max(
    priorLaunches.priorHighRiskTokenCount ?? 0,
    deployerRisk.maliciousContractsCreated ?? 0,
    ownerRisk.maliciousContractsCreated ?? 0,
  );
  const priorRugLikeTokenCount = Math.max(
    priorLaunches.priorRugLikeTokenCount ?? 0,
    deployerRisk.maliciousContractsCreated ?? 0,
  );
  const maliciousAddressHits = [deployerRisk.flagged, ownerRisk.flagged].filter(Boolean).length;
  const degradedReasons = unique([
    ...deployerRisk.degradedReasons,
    ...ownerRisk.degradedReasons,
    ...recentContractsResult.degradedReasons,
    ...priorLaunches.degradedReasons,
  ]);

  let confidence: HistoryConfidence = "low";
  if (recentContractsResult.addresses.length > 0 && deployerRisk.flagged !== null) {
    confidence = priorLaunches.confidence === "high" ? "high" : "medium";
  } else if (recentContractsResult.addresses.length > 0 || deployerRisk.flagged !== null) {
    confidence = "medium";
  } else if (input.issuerSignals.supported) {
    confidence = "low";
  }

  return {
    deployerAddress,
    ownerAddress,
    relatedAddresses: input.issuerSignals.relatedAddresses,
    priorTokenCount: priorLaunches.priorTokenCount,
    priorHighRiskTokenCount,
    priorRugLikeTokenCount,
    priorAbandonedTokenCount: priorLaunches.priorAbandonedTokenCount,
    maliciousAddressHits,
    flaggedDeployer: deployerRisk.flagged,
    flaggedOwner: ownerRisk.flagged,
    priorLpPullCount: priorLaunches.priorLpPullCount,
    priorFastLiquidityCollapseCount: priorLaunches.priorFastLiquidityCollapseCount,
    priorPermissionAbuseCount: priorLaunches.priorPermissionAbuseCount,
    priorFakeRenouncePatternCount: priorLaunches.priorFakeRenouncePatternCount,
    contractSimilarityRisk:
      priorHighRiskTokenCount >= 3 ? "high" : priorHighRiskTokenCount >= 1 ? "medium" : "unknown",
    insiderDumpPattern:
      concentrationRisk || (priorLaunches.priorLpPullCount ?? 0) >= 2
        ? "strong"
        : moderateConcentrationRisk || (priorLaunches.priorFastLiquidityCollapseCount ?? 0) >= 1
          ? "suspected"
          : "unknown",
    creatorSupplyPct: input.issuerSignals.creatorPercent,
    ownerSupplyPct: input.issuerSignals.ownerPercent,
    lpLockedPct: input.liquidityLock.lockedLpPercent,
    confidence,
    degradedReasons,
  };
}
