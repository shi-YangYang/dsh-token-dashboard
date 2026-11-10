<p align="center"><a href="./README.md">中文</a> · <a href="./README.en.md"><strong>English</strong></a></p>

<p align="center">
  <img src="./icon.svg" width="76" height="76" alt="dsh-token-dashboard" />
</p>

<h1 align="center">dsh-token-dashboard</h1>

<p align="center"><strong>Usage, cost, and request latency for every DeepSeek Harness session.</strong></p>

<p align="center">A local-first Cordis plugin that turns local DSH session history into a native dashboard.</p>

<p align="center">
  <img alt="DSH 0.2.1-rc.3" src="https://img.shields.io/badge/DSH-0.2.1--rc.3-4F6EF7?style=flat-square" />
  <img alt="Cordis plugin" src="https://img.shields.io/badge/Cordis-plugin-2B3FB8?style=flat-square" />
  <img alt="Node 22.18+" src="https://img.shields.io/badge/Node-%E2%89%A522.18-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img alt="TypeScript 5.9" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="MIT License" src="https://img.shields.io/badge/License-MIT-2B3FB8?style=flat-square" />
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#development">Development</a>
</p>

---

## Overview

DSH already shows token usage for the session in front of you. It does not show the whole picture: every project, model, subagent, fork, and request across your local history.

`@shi-yangyang/dsh-token-dashboard` adds that missing layer as a native plugin, displayed as **Token usage** in DSH.

The Host half reads session logs through the official `sessionPersistence` service and folds them with the same four-bucket accounting used by `@deepseek-ai/dsh-token-meter`. The Client half registers a `main` panel and a sidebar-footer entry using DSH slots, then renders with the host React runtime and theme tokens. Interactive controls are built on **beUI** (Tailwind CSS + Motion).

The plugin never writes a session log, changes a model request, or uploads session data. The logs remain the only source of truth.

## Features

- **Global usage in one view** — totals, uncached input, output, cache read/write, request count, cache hit rate, and session counts across all sessions in the active profile.
- **Token activity heatmap** — a one-year calendar heatmap with daily, weekly, and cumulative views; hover a cell for the date, token count, and request count.
- **Models and sessions** — searchable, filterable, sortable tables with pagination and a session detail drawer.
- **Request log** — one row per billed request, with time, app, provider, model, new input, output, cache hit, cost, speed, and first-token latency.
- **Cost estimates** — a built-in 453-model priced OpenRouter snapshot plus hand-maintained DeepSeek peak rates; override any price on the dedicated **Rates** page, or refresh from OpenRouter on demand.
- **Native and local-first** — DSH slots, DSH theme tokens, English/中文 UI, same-origin read-only routes, and exports that strip the working directory.

## Quick start

The package name is **`@shi-yangyang/dsh-token-dashboard`**. For now, build from source and install it as a local bundle as described below. The unscoped `dsh-token-dashboard` package on npm belongs to another project; do not use `npm install dsh-token-dashboard` to install this plugin.

### Requirements

- A DeepSeek Harness installation with the Web UI. Verified on DSH Desktop `0.2.1-rc.3` (Cordis `4.0.5`).
- Node.js **22.18 or newer** and `pnpm` when building from source.

### Build

```bash
git clone https://github.com/shi-YangYang/dsh-token-dashboard.git
cd dsh-token-dashboard
pnpm install
```

`pnpm install` automatically builds the Host and Client through `prepare`, generating the uncommitted `lib/` and `client/` outputs. Run `pnpm build` to rebuild after changing the source.

### Install into DSH

Install this directory as a local bundle from DSH's **Plugins** interface, or from a DSH agent:

```text
plugin_manager(action: "install_bundle", target: "/absolute/path/to/dsh-token-dashboard")
```

Enable the bundle if your profile has it disabled, then refresh the DSH Web page. Open **Token usage** from the sidebar footer, above Settings.

Updating Host code requires a DSH restart; Client-only changes need a page refresh.

## Usage

| Page | What it shows |
| --- | --- |
| **Overview** | Global KPIs and a one-year Token activity heatmap |
| **Models** | Token distribution and request counts by provider/model |
| **Sessions** | Search, filters, sorting, pagination, and per-session detail |
| **Request log** | Individual billed requests, 12 per page, newest first |
| **Costs** | Estimated spend, per-model breakdown, and online price refresh |
| **Rates** | Dedicated editor for every built-in model price; saved overrides immediately affect cost estimates |

The header provides the language switch, scan interval, **Sync now**, and export. Scan interval controls local session polling: **5 / 10 / 30 / 60 seconds**. All list tables show up to 12 rows per page with compact natural row heights; pagination stays at the footer and no list introduces an inner scrollbar.

Request-log cost is calculated with the current pricing table in the browser; unpriced models show `—`. Speed is output tokens divided by the measured request window. First-token latency runs from `step/start` to the first stream record; requests without stream timing show `—`.

Prices are estimates, not provider invoices. The built-in DeepSeek rates are peak-hour prices; off-peak rates are approximately half. Edit any model rate on the **Rates** page; overrides and online price cache live in the browser's `localStorage`.

## Architecture

```mermaid
flowchart LR
  Logs[(Session logs)] --> Host[Host aggregator]
  Live[session/event] --> Host
  Host --> Fold[Token fold + revision cache]
  Fold --> Routes[Read-only same-origin JSON]
  Routes --> Client[React dashboard in DSH slots]
  Client --> Views[Overview · Models · Sessions · Requests · Costs · Rates]
```

- **Host** (`src/host`) reads the official session store, folds usage incrementally, handles pricing, and serves the dashboard API. The cache is in memory and keyed by session revision (or live sequence); there is no second database or ledger.
- **Client** (`src/client`) registers `main` and `sidebar.footer.action` slots, manages scan/language/price preferences, and renders the dashboard. React is supplied by the host and is not bundled twice; BeUI component source lives in `src/client/beui/`, with Tailwind CSS injected at build time.
- **Shared** (`src/shared`) contains the wire types, four-bucket arithmetic, range selection, pricing, and formatting used by both sides.

Usage follows the published `tokenUsage` semantics: four disjoint provider buckets, final samples replacing stream samples for the same attempt, retries opening a new attempt, and inherited fork prefixes excluded from totals. See [`src/host/fold.ts`](./src/host/fold.ts) for the implementation.

The HTTP surface is read-only and same-origin:

| Route | Purpose |
| --- | --- |
| `GET /dsh-token-dashboard/stats` | Dashboard payload; supports ETag/`304` and `?refresh=1` |
| `GET /dsh-token-dashboard/requests` | Paginated request log; `?offset=0&limit=24` |
| `GET /dsh-token-dashboard/prices` | Optional OpenRouter prices; `?models=a,b&refresh=1` |
| `GET /dsh-token-dashboard/health` | Liveness, API version, and current revision |
| `GET /dsh-token-dashboard/verify` | Diagnostic comparison with the official `tokenUsage` projection |

All routes use the Host Connection gate when available and return `Cache-Control: no-store`; `/stats` is the only route with a weak ETag. No prompts, assistant text, tool arguments, credentials, or file contents are exposed.

## Development

```bash
pnpm install
pnpm build        # Host (tsc) + Client (Tailwind + esbuild)
pnpm typecheck    # Host, Client, and Test type checks
pnpm test         # 84 tests: unit, routes, SSR, jsdom, bundle
pnpm verify:real  # fold real local logs against an independent reference
pnpm build:prices # refresh the generated OpenRouter price snapshot (network)
```

`pnpm verify:real` requires built artifacts and local session logs; it is the best check when changing the fold.

```text
src/host      session source, token fold, aggregation, prices, HTTP routes
src/client    React UI, DSH slots, hooks, BeUI controls, theme-token styles
src/shared    wire types, pricing, ranges, formatting
test          node:test suites plus SSR/jsdom rendering checks
scripts       build, test, and real-session verification
```

## Contributing

Issues and pull requests are welcome. Run `pnpm typecheck` and `pnpm test` before submitting; include a regression test for behavior changes and preserve the read-only, no-upload data contract.

## Limitations

- Covers the active DSH profile's local session store only; remote, cloud, and other-profile sessions are not included.
- The first dashboard open scans history into an in-memory cache. A DSH restart starts fresh; there is no persistent index.
- Request speed and first-token latency depend on recorded stream timestamps. Older logs, or requests without streams, show `—`.
- Cost is a list-price estimate in USD, not a bill. The OpenRouter snapshot is dated **2026-11-09** (eight variable-price auto-router models are intentionally left unpriced and show `—`); online refresh and user overrides can change the displayed estimate.
- Session navigation depends on the optional `uiWorkspace.openSession` host service.

## License

[MIT](./LICENSE) © 2026 小洋

UI controls are based on [beUI](https://github.com/starc007/ui-components) (MIT). See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

Built for DeepSeek Harness and Cordis. Pricing data comes from the public OpenRouter model list and DeepSeek's published rates.
