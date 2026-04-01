# Degen Vibe Check

Minimal responsive dashboard for quick token due diligence across liquidity, contract risk, and hype.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- DexScreener API
- GoPlus Token Security API

## What It Does

- Search a token by contract address
- Pull the most liquid DexScreener pair
- Score `Liquidity Health`, `Contract Risk`, and `FOMO Signal`
- Combine them into a single `Vibe Score`
- Explain the score with short, human-readable reasons
- Show richer card-level basis, reminders, LP lock hints, and grouped FOMO context
- Use real X and Farcaster mention data when keys are configured
- Degrade gracefully to market-participation proxies when social coverage is partial
- Use real issuer wallet checks and sampled prior launches when supported
- Use historical OHLCV to compute launch spike and peak-to-current drawdown

## Scoring

- Liquidity Health: 40%
- Contract Risk: 40%
- FOMO Signal: 20%

This is an MVP heuristic, not a trading recommendation.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If your environment has local watcher limits, try:

```bash
npm run dev -- --hostname 127.0.0.1
```

## API

- `GET /api/analyze?q=<tokenAddress>`

Returns the analyzed token, score breakdown, security flags, raw metrics, and explanation bullets.

## Real Social Setup

Set these environment variables to enable real social search:

- `X_API_BEARER_TOKEN`
- `NEYNAR_API_KEY`

Optional caps:

- `X_SEARCH_MAX_PAGES`
- `NEYNAR_SEARCH_MAX_PAGES`

The app now pulls:

- X mentions via recent search
- Farcaster mentions via Neynar v2 cast search
- DexScreener boosts / paid orders / on-chain participation proxies

If a provider is missing, rate-limited, or query quality is constrained, the UI explicitly shows degraded-mode messages such as:

- `X data unavailable`
- `Farcaster signal limited`
- `Using market participation proxies`

This avoids treating missing data as zero attention.

## History Data Setup

Set this optional environment variable to enable issuer-wallet malicious-address checks:

- `GOPLUS_ACCESS_TOKEN`

Optional sampling caps:

- `BLOCKSCOUT_MAX_PAGES`
- `PRIOR_LAUNCH_SAMPLE_LIMIT`

The app now pulls:

- GoPlus address security for deployer / owner wallet risk hits
- Blockscout explorer transactions to sample recent prior contract launches by deployer
- DexScreener + GoPlus token checks to classify sampled prior launches
- GeckoTerminal OHLCV to calculate `launch spike ratio` and `peak-to-current drawdown`

If a chain or provider does not support one of these lookups, the History module explicitly shows degraded-mode messages instead of silently treating missing history as clean.

## Notes

- DexScreener is used as the market and hype proxy source.
- GoPlus is used for free contract security checks on supported EVM chains.
- GoPlus Address Security is used for malicious-address checks when `GOPLUS_ACCESS_TOKEN` is present.
- Blockscout-backed chains can surface sampled deployer launch history without running a custom indexer.
- GeckoTerminal is used for historical OHLCV on supported chains.
- GoPlus `lp_holders` data is used as a lightweight LP lock signal when available.
- Social quality blends mention volume, growth, platform mix, paid exposure, and trading conversion.
- Unsupported chains fall back to a neutral contract score instead of failing the whole request.
