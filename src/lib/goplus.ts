import {
  GoPlusIssuerSignals,
  LiquidityLockSignals,
  SecurityFlags,
} from "@/lib/types";
import { toBooleanFlag } from "@/lib/utils";

type GoPlusResponse = {
  result?: Record<string, Record<string, unknown>>;
};

type GoPlusHolder = {
  address?: string;
  percent?: string | number;
  is_locked?: string | number | boolean;
};

type GoPlusRecord = Record<string, unknown>;

const GOPLUS_API = "https://api.gopluslabs.io/api/v1/token_security";

const CHAIN_ID_MAP: Record<string, string> = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  avalanche: "43114",
  base: "8453",
  optimism: "10",
  linea: "59144",
  scroll: "534352",
  fantom: "250",
  cronos: "25",
};

export function resolveGoPlusChainId(chainId: string) {
  return CHAIN_ID_MAP[chainId] ?? null;
}

const DEFAULT_FLAGS: SecurityFlags = {
  supported: false,
  canMint: false,
  blacklistEnabled: false,
  whitelistEnabled: false,
  tradingPausable: false,
  ownerCanModifyTax: false,
  honeypotRisk: false,
  proxyUpgradeable: false,
  openSource: false,
  ownerRenounced: false,
};

async function fetchGoPlusRecord(chainId: string, tokenAddress: string) {
  const mappedChainId = resolveGoPlusChainId(chainId);
  if (!mappedChainId) {
    return null;
  }

  const response = await fetch(
    `${GOPLUS_API}/${mappedChainId}?contract_addresses=${tokenAddress}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GoPlus request failed: ${response.status}`);
  }

  const data = (await response.json()) as GoPlusResponse;
  return (data.result?.[tokenAddress.toLowerCase()] as GoPlusRecord | undefined) ?? null;
}

function mapTokenSecurity(result: GoPlusRecord | null): SecurityFlags {
  if (!result) {
    return DEFAULT_FLAGS;
  }

  return {
    supported: true,
    canMint: toBooleanFlag(result.is_mintable),
    blacklistEnabled: toBooleanFlag(result.is_blacklisted) || toBooleanFlag(result.blacklist),
    whitelistEnabled: toBooleanFlag(result.whitelist),
    tradingPausable: toBooleanFlag(result.can_take_back_ownership) || toBooleanFlag(result.transfer_pausable),
    ownerCanModifyTax:
      toBooleanFlag(result.slippage_modifiable) || toBooleanFlag(result.personal_slippage_modifiable),
    honeypotRisk: toBooleanFlag(result.is_honeypot),
    proxyUpgradeable: toBooleanFlag(result.is_proxy),
    openSource: toBooleanFlag(result.is_open_source),
    ownerRenounced: toBooleanFlag(result.owner_address) ? false : true,
  };
}

function normalizePercent(value: string | number | undefined) {
  if (value === undefined) {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return numeric <= 1 ? numeric * 100 : numeric;
}

function mapLiquidityLockSignals(result: GoPlusRecord | null): LiquidityLockSignals {
  if (!result) {
    return {
      supported: false,
      lockedLpPercent: null,
      unlockedTopLpPercent: null,
      lockSummary: "LP lock data is not available on this chain.",
    };
  }
  const lpHolders = (result.lp_holders as GoPlusHolder[] | undefined) ?? [];

  if (lpHolders.length === 0) {
    return {
      supported: false,
      lockedLpPercent: null,
      unlockedTopLpPercent: null,
      lockSummary: "No LP holder lock signal was returned by the security scan.",
    };
  }

  const lockedLpPercent = lpHolders.reduce((sum, holder) => {
    return sum + (toBooleanFlag(holder.is_locked) ? normalizePercent(holder.percent) : 0);
  }, 0);

  const unlockedTopLpPercent = lpHolders.reduce((sum, holder) => {
    return sum + (!toBooleanFlag(holder.is_locked) ? normalizePercent(holder.percent) : 0);
  }, 0);

  let lockSummary = "Top LP holders do not show a clear lock signal.";
  if (lockedLpPercent >= 70) {
    lockSummary = "Most observed LP positions look locked.";
  } else if (lockedLpPercent >= 25) {
    lockSummary = "Some LP appears locked, but not enough to fully relax.";
  }

  return {
    supported: true,
    lockedLpPercent: Number(lockedLpPercent.toFixed(1)),
    unlockedTopLpPercent: Number(unlockedTopLpPercent.toFixed(1)),
    lockSummary,
  };
}

function mapIssuerSignals(result: GoPlusRecord | null): GoPlusIssuerSignals {
  if (!result) {
    return {
      supported: false,
      deployerAddress: null,
      ownerAddress: null,
      relatedAddresses: [],
      creatorPercent: null,
      ownerPercent: null,
      holderCount: null,
      topHolderPercent: null,
      hiddenOwner: false,
    };
  }

  const holders = (result.holders as GoPlusHolder[] | undefined) ?? [];
  const topHolderPercent =
    holders.length > 0 ? Number(normalizePercent(holders[0]?.percent).toFixed(1)) : null;

  const relatedAddresses = [
    typeof result.creator_address === "string" ? result.creator_address : null,
    typeof result.owner_address === "string" ? result.owner_address : null,
    ...holders.slice(0, 3).map((holder) =>
      typeof holder.address === "string" ? holder.address : null,
    ),
  ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

  return {
    supported: true,
    deployerAddress:
      typeof result.creator_address === "string" ? result.creator_address : null,
    ownerAddress: typeof result.owner_address === "string" ? result.owner_address : null,
    relatedAddresses,
    creatorPercent:
      result.creator_percent !== undefined
        ? Number(normalizePercent(result.creator_percent as string | number).toFixed(1))
        : null,
    ownerPercent:
      result.owner_percent !== undefined
        ? Number(normalizePercent(result.owner_percent as string | number).toFixed(1))
        : null,
    holderCount:
      typeof result.holder_count === "string" || typeof result.holder_count === "number"
        ? Number(result.holder_count)
        : null,
    topHolderPercent,
    hiddenOwner: toBooleanFlag(result.hidden_owner),
  };
}

export async function fetchGoPlusSignals(chainId: string, tokenAddress: string) {
  const result = await fetchGoPlusRecord(chainId, tokenAddress);

  return {
    security: mapTokenSecurity(result),
    liquidityLock: mapLiquidityLockSignals(result),
    issuerSignals: mapIssuerSignals(result),
  };
}
