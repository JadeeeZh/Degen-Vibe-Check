"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  Flame,
  History,
  LoaderCircle,
  Search,
  Shield,
  Sparkles,
  Waves,
} from "lucide-react";

import { AnalyzeResult, HistoryBullet, ScoreBreakdown, SignalLevel } from "@/lib/types";
import {
  cn,
  formatCompactNumber,
  formatCurrency,
  formatPercent,
} from "@/lib/utils";

function useIsLargeScreen() {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return isLg;
}

const EXAMPLES = [
  "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
  "0x4200000000000000000000000000000000000006",
];

function getApiErrorMessage(payload: AnalyzeResult | { error?: string }) {
  if ("error" in payload) {
    return payload.error ?? "Unable to fetch token analysis.";
  }

  return "Unable to fetch token analysis.";
}

function isAnalyzeResult(payload: AnalyzeResult | { error?: string }): payload is AnalyzeResult {
  return !("error" in payload);
}

function signalClasses(level: SignalLevel) {
  if (level === "green") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 shadow-[0_0_40px_rgba(16,185,129,0.15)]";
  }

  if (level === "yellow") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-100 shadow-[0_0_40px_rgba(245,158,11,0.12)]";
  }

  return "border-rose-400/30 bg-rose-500/10 text-rose-100 shadow-[0_0_40px_rgba(244,63,94,0.12)]";
}

function scoreRingClasses(score: number) {
  if (score >= 80) {
    return "from-emerald-300 via-lime-300 to-cyan-300";
  }

  if (score >= 60) {
    return "from-amber-200 via-orange-300 to-fuchsia-300";
  }

  return "from-rose-300 via-orange-300 to-red-400";
}

function detailToneClasses(tone?: SignalLevel | "neutral") {
  if (tone === "green") {
    return "text-emerald-200";
  }

  if (tone === "yellow") {
    return "text-amber-100";
  }

  if (tone === "red") {
    return "text-rose-100";
  }

  return "text-white";
}

function calloutToneClasses(tone?: SignalLevel | "neutral") {
  if (tone === "green") {
    return "border-emerald-400/20 bg-emerald-500/10";
  }

  if (tone === "yellow") {
    return "border-amber-400/20 bg-amber-500/10";
  }

  if (tone === "red") {
    return "border-rose-400/20 bg-rose-500/10";
  }

  return "border-white/10 bg-white/5";
}

function Card({
  label,
  breakdown,
  icon,
}: {
  label: string;
  breakdown: ScoreBreakdown;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasSections = Boolean(breakdown.sections?.length);

  return (
    <div
      className={cn(
        "rounded-3xl border p-5 backdrop-blur-xl",
        signalClasses(breakdown.level),
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm font-medium uppercase tracking-[0.24em] text-white/70">
          <span className="rounded-full border border-white/10 bg-white/5 p-2 text-white">
            {icon}
          </span>
          {label}
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/60">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              breakdown.level === "green"
                ? "bg-emerald-300"
                : breakdown.level === "yellow"
                  ? "bg-amber-300"
                  : "bg-rose-300",
            )}
          />
          {breakdown.level}
        </div>
      </div>
      <div className="text-4xl font-semibold text-white">{breakdown.score}</div>
      <p className="mt-3 text-base font-medium leading-6 text-white">{breakdown.headline}</p>
      <p className="mt-2 text-sm leading-6 text-white/72">{breakdown.summary}</p>

      {breakdown.callout ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/80">
          {breakdown.callout}
        </div>
      ) : null}

      {hasSections ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium uppercase tracking-[0.24em] text-white/60 transition hover:bg-white/8 hover:text-white/80"
          >
            {open ? "Hide Details" : "Show Details"}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>

          <div
            style={{
              maxHeight: open ? "2000px" : "0px",
              opacity: open ? 1 : 0,
              transition: open
                ? "max-height 400ms ease-in-out, opacity 300ms ease-in"
                : "max-height 300ms ease-in-out, opacity 200ms ease-out",
            }}
            className="overflow-hidden"
          >
            {breakdown.sections?.map((section) => (
              <div key={section.title} className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.28em] text-white/38">
                  {section.title}
                </div>
                <div>
                  {section.items.map((item) => (
                    <div
                      key={`${section.title}-${item.label}`}
                      className="flex items-center justify-between gap-4 border-b border-white/8 py-2.5 text-[13px] leading-[22px] last:border-b-0"
                    >
                      <span className="text-white/52">{item.label}</span>
                      <span className={cn("text-right font-medium", detailToneClasses(item.tone))}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 py-3 text-sm last:border-b-0">
      <span className="text-white/52">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

function SecurityBadge({
  active,
  label,
  danger = false,
}: {
  active: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? danger
            ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
            : "border-amber-400/30 bg-amber-500/10 text-amber-100"
          : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      )}
    >
      {label}: {active ? "Yes" : "No"}
    </span>
  );
}

function SignalModule({
  label,
  title,
  detail,
  tone,
  icon,
}: {
  label: string;
  title: string;
  detail: string;
  tone: SignalLevel | "neutral";
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] border p-5 backdrop-blur-xl",
        calloutToneClasses(tone),
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-white/48">
        <span className="rounded-full border border-white/10 bg-black/20 p-2 text-white">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-4 text-xl font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-white/72">{detail}</p>
    </div>
  );
}

function CollapsibleBullets({ bullets }: { bullets: HistoryBullet[] }) {
  const [open, setOpen] = useState(false);

  if (bullets.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55 transition hover:bg-white/8 hover:text-white/75"
      >
        {open ? "Hide Evidence" : "Show Evidence"}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        style={{
          maxHeight: open ? "1500px" : "0px",
          opacity: open ? 1 : 0,
          transition: open
            ? "max-height 400ms ease-in-out, opacity 300ms ease-in"
            : "max-height 300ms ease-in-out, opacity 200ms ease-out",
        }}
        className="overflow-hidden"
      >
        <div className="mt-3 space-y-4">
          {bullets.map((bullet) => (
            <div
              key={bullet.text}
              className="flex gap-3 text-sm leading-6"
            >
              <span
                className={cn(
                  "mt-2 h-2 w-2 shrink-0 rounded-full",
                  bullet.tone === "green"
                    ? "bg-emerald-300"
                    : bullet.tone === "yellow"
                      ? "bg-amber-300"
                      : bullet.tone === "red"
                        ? "bg-rose-300"
                        : "bg-white/30",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="m-0 font-medium text-white/85">{bullet.text}</p>
                {bullet.detail ? (
                  <p className="m-0 mt-1 text-xs leading-5 text-white/42">
                    {bullet.detail}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardClient({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isLg = useIsLargeScreen();

  useEffect(() => {
    async function loadFromQuery() {
      if (!initialQuery) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/analyze?q=${encodeURIComponent(initialQuery)}`);
        const payload = (await response.json()) as AnalyzeResult | { error?: string };

        if (!response.ok || !isAnalyzeResult(payload)) {
          throw new Error(getApiErrorMessage(payload));
        }

        setResult(payload);
      } catch (requestError) {
        setResult(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to fetch token analysis.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadFromQuery();
  }, [initialQuery]);

  async function submit(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      setError("Paste a token address to run the vibe check.");
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("q", trimmed);
    window.history.replaceState(null, "", url);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analyze?q=${encodeURIComponent(trimmed)}`);
      const payload = (await response.json()) as AnalyzeResult | { error?: string };

      if (!response.ok || !isAnalyzeResult(payload)) {
        throw new Error(getApiErrorMessage(payload));
      }

      setResult(payload);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to fetch token analysis.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(query);
  }

  return (
    <div className="relative isolate min-h-screen text-white">
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-[0_0_120px_rgba(168,85,247,0.08)] backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-fuchsia-200">
                <Flame className="h-3.5 w-3.5" />
                Degen Signal Board
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Degen Vibe Check
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/68 sm:text-lg">
                Paste a token address. Get a fast read on liquidity, risk, and hype.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/52">
              Not financial advice. Signals can lag or be incomplete.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
            <label
              htmlFor="token-address"
              className="text-xs font-medium uppercase tracking-[0.24em] text-white/45"
            >
              Token Address
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
                <input
                  id="token-address"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="0x... or token contract address"
                  className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-white/24 focus:border-fuchsia-400/40 focus:bg-black/40"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-500 via-orange-400 to-amber-300 px-6 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Scanning
                  </>
                ) : (
                  "Check Vibe"
                )}
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  void submit(example);
                }}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
              >
                Try {example.slice(0, 6)}...{example.slice(-4)}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </section>

        {loading && !result ? (
          <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-[32px] border border-white/10 bg-white/6 p-8 backdrop-blur-xl">
              <div className="animate-pulse space-y-4">
                <div className="h-6 w-40 rounded-full bg-white/10" />
                <div className="h-20 w-52 rounded-3xl bg-white/10" />
                <div className="grid gap-4">
                  <div className="h-40 rounded-3xl bg-white/10" />
                  <div className="h-40 rounded-3xl bg-white/10" />
                  <div className="h-40 rounded-3xl bg-white/10" />
                </div>
              </div>
            </div>
            <div className="rounded-[32px] border border-white/10 bg-white/6 p-8 backdrop-blur-xl">
              <div className="animate-pulse space-y-4">
                <div className="h-5 w-24 rounded-full bg-white/10" />
                <div className="h-10 rounded-2xl bg-white/10" />
                <div className="h-10 rounded-2xl bg-white/10" />
                <div className="h-10 rounded-2xl bg-white/10" />
              </div>
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-2xl sm:p-8">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-white/48">
                      <span>{result.token.chainId}</span>
                      <span className="text-white/20">/</span>
                      <span>{result.token.dexId}</span>
                      <span className="text-white/20">/</span>
                      <span>Quoted in {result.token.quoteSymbol}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                        {result.token.name}
                      </h2>
                      <span className="pb-1 text-lg text-white/52">
                        ${result.token.symbol}
                      </span>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                      Contract {result.token.address}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 rounded-[28px] border border-white/10 bg-black/20 px-5 py-4">
                    <div
                      className={cn(
                        "flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br text-4xl font-semibold text-black",
                        scoreRingClasses(result.vibeScore),
                      )}
                    >
                      {result.vibeScore}
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/42">
                        Vibe Score
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {result.verdict}
                      </div>
                      <div className="mt-2 text-sm text-white/52">
                        Updated {new Date(result.fetchedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-4">
                  <Card
                    label="Liquidity Health"
                    breakdown={result.cards.liquidity}
                    icon={<Waves className="h-4 w-4" />}
                  />
                  <Card
                    label="Contract Risk"
                    breakdown={result.cards.contract}
                    icon={<Shield className="h-4 w-4" />}
                  />
                  <Card
                    label="FOMO Signal"
                    breakdown={result.cards.fomo}
                    icon={<Flame className="h-4 w-4" />}
                  />
                </div>
              </div>

              {isLg && (
                <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                  <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                    Why This Score
                  </div>
                  <div className="mt-5 space-y-3">
                    {result.why.map((item) => (
                      <div
                        key={item}
                        className="flex gap-3 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-white/72"
                      >
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-fuchsia-300" />
                        <span className="min-w-0">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isLg && (
                <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                  <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                    Security Flags
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <SecurityBadge
                      active={result.security.honeypotRisk}
                      label="Honeypot"
                      danger
                    />
                    <SecurityBadge
                      active={result.security.canMint}
                      label="Mintable"
                      danger
                    />
                    <SecurityBadge
                      active={result.security.blacklistEnabled}
                      label="Blacklist"
                      danger
                    />
                    <SecurityBadge
                      active={result.security.tradingPausable}
                      label="Trading Pause"
                      danger
                    />
                    <SecurityBadge
                      active={result.security.ownerCanModifyTax}
                      label="Tax Control"
                    />
                    <SecurityBadge
                      active={result.security.proxyUpgradeable}
                      label="Upgradeable"
                    />
                    <SecurityBadge
                      active={!result.security.openSource}
                      label="Not Open Source"
                    />
                    <SecurityBadge
                      active={!result.security.ownerRenounced}
                      label="Owner Active"
                    />
                  </div>
                </div>
              )}

            </div>

            <aside className="space-y-6">
              <div className="grid gap-4">
                <SignalModule
                  label="Biggest Risk"
                  title={result.biggestRisk.title}
                  detail={result.biggestRisk.detail}
                  tone={result.biggestRisk.tone}
                  icon={<AlertTriangle className="h-4 w-4" />}
                />
                <SignalModule
                  label="Best Signal"
                  title={result.bestSignal.title}
                  detail={result.bestSignal.detail}
                  tone={result.bestSignal.tone}
                  icon={<Sparkles className="h-4 w-4" />}
                />
              </div>

              {!isLg && (
                <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                  <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                    Why This Score
                  </div>
                  <div className="mt-5 space-y-3">
                    {result.why.map((item) => (
                      <div
                        key={item}
                        className="flex gap-3 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-white/72"
                      >
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-fuchsia-300" />
                        <span className="min-w-0">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                  <span className="rounded-full border border-white/10 bg-black/20 p-2 text-white">
                    <History className="h-4 w-4" />
                  </span>
                  History
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] tracking-[0.18em] text-white/55">
                    Included In Vibe Score
                  </span>
                </div>

                <div
                  className={cn(
                    "mt-5 rounded-2xl border p-4",
                    calloutToneClasses(result.history.summary.tone),
                  )}
                >
                  <div className="text-sm font-semibold text-white">
                    {result.history.summary.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/74">
                    {result.history.summary.detail}
                  </p>
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/45">
                      Issuer Reputation
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <div className="text-3xl font-semibold text-white">
                        {result.history.issuerReputation.score}
                      </div>
                      <div
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium",
                          calloutToneClasses(result.history.issuerReputation.tone),
                        )}
                      >
                        {result.history.issuerReputation.label}
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-white/82">
                      {result.history.issuerReputation.summary}
                    </p>
                    <CollapsibleBullets bullets={result.history.issuerReputation.bullets} />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/45">
                      Post-Launch Behavior
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <div className="text-3xl font-semibold text-white">
                        {result.history.dumpPattern.score}
                      </div>
                      <div
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium",
                          calloutToneClasses(result.history.dumpPattern.tone),
                        )}
                      >
                        {result.history.dumpPattern.label}
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-white/82">
                      {result.history.dumpPattern.summary}
                    </p>
                    <CollapsibleBullets bullets={result.history.dumpPattern.bullets} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/60">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Confidence: {result.history.confidence}
                  </span>
                  {result.history.degradedReasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>

              {!isLg && (
                <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                  <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                    Security Flags
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <SecurityBadge
                      active={result.security.honeypotRisk}
                      label="Honeypot"
                      danger
                    />
                    <SecurityBadge
                      active={result.security.canMint}
                      label="Mintable"
                      danger
                    />
                    <SecurityBadge
                      active={result.security.blacklistEnabled}
                      label="Blacklist"
                      danger
                    />
                    <SecurityBadge
                      active={result.security.tradingPausable}
                      label="Trading Pause"
                      danger
                    />
                    <SecurityBadge
                      active={result.security.ownerCanModifyTax}
                      label="Tax Control"
                    />
                    <SecurityBadge
                      active={result.security.proxyUpgradeable}
                      label="Upgradeable"
                    />
                    <SecurityBadge
                      active={!result.security.openSource}
                      label="Not Open Source"
                    />
                    <SecurityBadge
                      active={!result.security.ownerRenounced}
                      label="Owner Active"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                <div className="mb-4 text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                  Raw Metrics
                </div>
                <MetricRow
                  label="Liquidity"
                  value={formatCurrency(result.metrics.liquidityUsd)}
                />
                <MetricRow
                  label="24h Volume"
                  value={formatCurrency(result.metrics.volume24h)}
                />
                <MetricRow
                  label="24h Price Change"
                  value={formatPercent(result.metrics.priceChange24h)}
                />
                <MetricRow
                  label="Buys / Sells"
                  value={`${formatCompactNumber(result.metrics.buys24h)} / ${formatCompactNumber(result.metrics.sells24h)}`}
                />
                <MetricRow
                  label="Pair Age"
                  value={`${result.metrics.pairAgeHours.toFixed(1)}h`}
                />
                <MetricRow
                  label="Volume / Liquidity"
                  value={result.metrics.volumeLiquidityRatio.toFixed(2)}
                />
                <MetricRow
                  label="Buy / Sell Ratio"
                  value={result.metrics.buySellRatio.toFixed(2)}
                />
                <MetricRow
                  label="Market Cap"
                  value={formatCurrency(result.metrics.marketCap)}
                />
                <MetricRow label="FDV" value={formatCurrency(result.metrics.fdv)} />
                <MetricRow
                  label="Boosts / Orders"
                  value={`${result.metrics.boostsActive} / ${result.metrics.paidOrderCount}`}
                />
                <MetricRow
                  label="24h Total Txns"
                  value={formatCompactNumber(result.metrics.totalTxns24h)}
                />
                <MetricRow
                  label="X Mentions 24h / 7d"
                  value={
                    `${result.social.xMentions24h === null ? "Unavailable" : formatCompactNumber(result.social.xMentions24h)} / ${result.social.xMentions7d === null ? "Unavailable" : formatCompactNumber(result.social.xMentions7d)}`
                  }
                />
                <MetricRow
                  label="Farcaster Mentions 24h / 7d"
                  value={
                    `${result.social.farcasterMentions24h === null ? "Unavailable" : formatCompactNumber(result.social.farcasterMentions24h)} / ${result.social.farcasterMentions7d === null ? "Unavailable" : formatCompactNumber(result.social.farcasterMentions7d)}`
                  }
                />
                <MetricRow
                  label="24h Social Growth"
                  value={
                    result.social.growth24hPct === null
                      ? "Unavailable"
                      : `${result.social.growth24hPct > 0 ? "+" : ""}${result.social.growth24hPct.toFixed(1)}%`
                  }
                />
                <MetricRow
                  label="Attention Quality"
                  value={result.fomoInterpretation}
                />
                <MetricRow
                  label="LP Locked"
                  value={
                    result.liquidityLock.lockedLpPercent === null
                      ? result.liquidityLock.lockSummary
                      : `${result.liquidityLock.lockedLpPercent.toFixed(1)}%`
                  }
                />
                {result.social.degradedReasons.map((reason) => (
                  <MetricRow key={reason} label="Data Coverage" value={reason} />
                ))}
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                  Score Reading
                </div>
                <div className="mt-5 space-y-3 text-sm leading-6 text-white/70">
                  <p>
                    <span className="font-semibold text-white">80-100:</span> Strong vibe,
                    still verify manually.
                  </p>
                  <p>
                    <span className="font-semibold text-white">60-79:</span> Mixed signals,
                    proceed carefully.
                  </p>
                  <p>
                    <span className="font-semibold text-white">0-59:</span> Risky or weak
                    fundamentals.
                  </p>
                </div>
              </div>

              {result.links.dexScreener ? (
                <a
                  href={result.links.dexScreener}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-[28px] border border-white/10 bg-white/6 p-5 text-sm text-white/74 transition hover:border-fuchsia-400/30 hover:text-white"
                >
                  <span>Open on DexScreener</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
            </aside>
          </section>
        ) : null}
      </main>
    </div>
  );
}
