<div align="center">

# WINAPI//CORE

**Windows API Intelligence Explorer**

A self-hosted, searchable reference for Windows APIs built from public intelligence sources — attack-categorized Win32 functions, MITRE ATT&CK mappings, native syscall tables, and the full Microsoft Learn API reference with `Requirements`/`Remarks` metadata auto-enriched per function.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/node-%3E%3D18.18-green)](https://nodejs.org)

</div>

---

## Table of Contents

- [What it does](#what-it-does)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Building the local database](#building-the-local-database)
  - [1. Fast sync (core intelligence)](#1-fast-sync-core-intelligence)
  - [2. Win32 catalog (full reference)](#2-win32-catalog-full-reference)
  - [3. Microsoft Learn enrichment](#3-microsoft-learn-enrichment)
  - [Offline mode](#offline-mode)
- [Using the app](#using-the-app)
- [REST API](#rest-api)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [License](#license)

---

## What it does

WINAPI//CORE downloads, merges, and indexes Windows API intelligence into a single local dataset served by a fast search UI and a JSON API. It is designed for analysts who need a quick, attacker-FIRST view of a function:

> "What does this API do, which malware categories use it, which MITRE technique it maps to, what is its native syscall number, and what does Microsoft officially document about it?"

Every record keeps its **source attribution** (`malapi`, `nt-native`, `win32k`, `catalog`) so you always know where a fact came from.

> **Note:** WINAPI//CORE is a *reference* tool for defenders and researchers. It indexes publicly published security-engineering data and Microsoft documentation. Many APIs are dual-use — use responsibly and only against systems you are authorized to analyze.

---

## Features

- **45,000+ function catalog** from the official `MicrosoftDocs/sdk-api` documentation tree (index-only mode, no giant clone).
- **Attack categorization** synced from [malapi.io](https://malapi.io): *Injection, Evasion, Spying, Enumeration, Anti-Debugging, Ransomware, Internet, Helper*.
- **MITRE ATT&CK mapping** — full enterprise technique set from the official STIX bundle, with per-function technique references and tactic facets.
- **Native syscall tables** from [j00ru/windows-syscalls](https://github.com/j00ru/windows-syscalls) (`ntdll.dll` + `win32k.sys`), including per-Windows-version syscall numbers for x64.
- **Microsoft Learn enrichment** — crawls the live documentation for each function and merges the official `Requirements` table (Header, Library, DLL, Minimum supported client/server, Target Platform) plus the `Remarks` section into the record (`fn.ms`).
- **Fully resumable + offline-capable** — every downloaded byte is cached to `data/raw/`; with `SYNC_OFFLINE=1` the app refuses any network access and works purely from local cache.
- **Analyst UI** — explorer with full-text search + facet filters (category, DLL, technique, tactic, source), technique browser, saved-function collection, and a live sync dashboard ("Data Core").
- **JSON REST API** — every dataset is queryable over HTTP with pagination and filters.

---

## Tech stack

| Layer    | Choice                                        |
| -------- | --------------------------------------------- |
| Runtime  | Node.js ≥ 18.18, Next.js 15 (App Router)      |
| Language | TypeScript (strict)                           |
| UI       | React 19, Tailwind CSS 4, framer-motion       |
| Parsing  | cheerio (HTML scraping), native `node:fs`     |

No external database — the dataset is plain JSON served straight from disk, so there is nothing to install or configure.

---

## Getting started

```bash
# 1. clone (or copy your own checkout)
git clone https://github.com/luel-4013/WINAPI_CORE.git
cd WINAPI_CORE

# 2. install dependencies
npm install

# 3. run in dev mode
npm run dev          # http://localhost:3000

# or build + start for production
npm run build
npm start
```

The UI loads immediately. The first thing you want to do is **build the local database** (next section) — the app ships with no data files, they are downloaded on demand into the git-ignored `data/` directory.

- `npm run typecheck` / `npm run lint` → `tsc --noEmit`

---

## Building the local database

The database is built by three independent sync stages. You control when each runs from the **Data Core** screen in the UI or via the REST API. All stages write to `./data` (git-ignored) and are **idempotent and resumable**.

### 1. Fast sync (core intelligence)

Pulls the three core sources and merges them into one function list:

- **MITRE ATT&CK** enterprise techniques — official STIX bundle (~45 MB, cached once).
- **malapi.io** — attack-flagged Win32 APIs with category + description + docs links.
- **j00ru/windows-syscalls** — `nt.csv` + `win32k.csv` system call tables.

```bash
# UI:  Data Core → "start sync"
curl -X POST http://localhost:3000/api/sync
# force re-download even when cached:
curl -X POST "http://localhost:3000/api/sync?force=1"
```

### 2. Win32 catalog (full reference)

Indexes the **entire documented Win32 API** from `MicrosoftDocs/sdk-api`. Two levels:

| Level | Cost | What you get |
| ----- | ---- | ------------ |
| **Index** (default) | Small (shallow, `blob:none` git clone) | All ~45k function names, namespaces, Microsoft Learn + GitHub source URLs. Adds every documented Win32 function as a browsable record. |
| **Materialize** | Large (several hundred MB) | Checks out the full markdown repo so the *official description + DLL* from each doc's frontmatter are available locally and offline. |

```bash
# UI:  Data Core → "catalog index" / "catalog content"
# index only (default)
curl -X POST http://localhost:3000/api/sync/catalog \
  -H "Content-Type: application/json" -d '{"materialize":false}'
# full content download
curl -X POST http://localhost:3000/api/sync/catalog \
  -H "Content-Type: application/json" -d '{"materialize":true}'
```

> The index step uses `git clone --depth 1 --filter=blob:none --no-checkout`, so it only downloads the tree — not the content blobs — until you explicitly choose `materialize`.

### 3. Microsoft Learn enrichment

For every indexed function that has a `learn.microsoft.com` URL, WINAPI//CORE downloads the live docs page and merges structured data into `fn.ms`:

- `dll`, `library`, `header` (official Requirements table),
- `minClient`, `minServer`, `platform`,
- `remarks` (the official Remarks section, truncated to 1200 chars).

Pages are fetched **attack-relevant first** (malapi + technique-mapped functions), cached as raw HTML under `data/raw/microsoft/`, and skipped when already present — so you can run it in chunks and it resumes exactly where it left off:

```bash
# UI:  Data Core → "microsoft enrichment"
# crawl everything (long; may take hours for the full 45k)
curl -X POST http://localhost:3000/api/sync/microsoft
# crawl a subset (recommended first pass — e.g. the ~400 attack-relevant pages)
curl -X POST "http://localhost:3000/api/sync/microsoft?limit=400"
# re-parse already-cached pages + fetch more (force)
curl -X POST "http://localhost:3000/api/sync/microsoft?force=1&limit=400"
```

Failed pages (timeouts/HTTP errors) are **not** cached and are retried on the next run — the crawl is safe to interrupt at any point.

### Offline mode

```bash
SYNC_OFFLINE=1 npm start     # also works for: next dev/build steps
```

With `SYNC_OFFLINE=1`, every outbound fetch throws. Sync stages then operate purely from disk (`data/raw/…`) and annotate that the run was offline. This proves a fully-air-gapped workflow after an initial online sync.

---

## Using the app

- **Explorer** — search and browse functions. Filter facets: attack category, DLL, MITRE tactic, technique, data source. Paginated results, 60/page.
- **Function detail** — click any function for the full record: aliases, sources, categories, technique chips, syscall numbers per Windows version, doc links (Microsoft Learn, GitHub source, MalAPI), saved-status. If Microsoft enrichment ran, the official Requirements + Remarks render in the drawer.
- **Techniques** — browse the full MITRE ATT&CK technique set, sub-technique hierarchy, and how many functions map to each technique.
- **Saved** — your local pinned-function collection (stored in the browser via `localStorage`).
- **Data Core** — the sync dashboard: database path/size, live progress + stage, source counts, and the three sync buttons.

---

## REST API

Base: `http://localhost:3000`

### Functions

| Endpoint | Description |
| -------- | ----------- |
| `GET /api/functions?q=&category=&dll=&technique=&tactic=&source=&page=&perPage=` | Search + filtered function list with facet counts. |
| `GET /api/functions/:id` | Full function record by id or name (e.g. `/api/functions/setwindowshookexa`). |
| `GET /api/functions/:id/doc` | Local catalog frontmatter (description/dll) if content was materialized. |

### Techniques

| Endpoint | Description |
| -------- | ----------- |
| `GET /api/techniques?q=&tactic=&page=&perPage=` | MITRE techniques with per-technique function counts. |
| `GET /api/techniques/:id` | Technique detail + all mapped functions. |

### Sync & status

| Endpoint | Description |
| -------- | ----------- |
| `POST /api/sync?force=1` | Run fast sync (MITRE + malapi + syscalls). |
| `POST /api/sync/catalog` | `{"materialize": false\|true}` — index or materialize the Win32 catalog. |
| `POST /api/sync/microsoft?limit=N&force=1` | Microsoft Learn enrichment crawl (resumable). |
| `GET /api/status` | Live sync state: stage, progress, log tail, source counts, db size. |
| `DELETE /api/sync` and `DELETE /api/sync/microsoft` | Reset sync status. |
| `GET /api/meta` | Global facet totals (categories, DLLs, tactics, sources) + status. |

All responses are JSON. Query params are comma-separated for the multi-value filters (`category=injection,evasion`).

---

## Data model

Each function record (`ApiFunction`) looks like:

```ts
{
  id: "setwindowshookexa",          // normalized key (lowercase)
  name: "SetWindowsHookExA",
  aliases: ["SetWindowsHookEx"],    // alternate spellings
  dll: "User32.dll",
  categories: ["Injection", "Spying"],      // malapi attack categories
  description: "Installs a hook procedure...",
  docsUrl: "https://learn.microsoft.com/...",  // canonical docs link
  docs: [{ label: "Microsoft Learn", url }, { label: "GitHub (source)", url }],
  sources: ["malapi", "catalog"],   // which datasets contributed facts
  techniques: [{ id: "T1055", name: "Process Injection", tactic: "Execution" }],
  attacks: ["Injection", "Process Injection"], // truthful derived labels
  syscalls: { "win11-22h2+x64": "1f", ... },   // native syscall numbers (if native API)
  ms: {  // merged from live Microsoft Learn docs
    dll: "User32.dll",
    header: "winuser.h (include Windows.h)",
    library: "User32.lib",
    minClient: "Windows 2000 Professional [desktop apps only]",
    minServer: "Windows 2000 Server [desktop apps only]",
    platform: "Windows",
    remarks: "SetWindowsHookEx can be used to inject a DLL into another process..."
  }
}
```

Data sources (`sources` values): `malapi` · `nt-native` (ntdll syscalls) · `win32k` (win32k.sys syscalls) · `catalog` (MicrosoftDocs catalog).

---

## Project structure

```
WINAPI_CORE/
├── app/                     # Next.js App Router
│   ├── page.tsx             # single-page shell
│   └── api/                 # REST routes
│       ├── functions/       # list, detail, local doc
│       ├── techniques/      # MITRE browse
│       ├── sync/            # fast sync / catalog / microsoft
│       ├── status/          # live sync state
│       └── meta/            # global facet totals
├── components/              # UI (Explorer, Techniques, Saved, Sync, DetailDrawer, …)
├── lib/
│   ├── types.ts             # data model (ApiFunction, Technique, SyncStatus, …)
│   ├── db.ts                # JSON store, status, caching helpers
│   ├── http.ts              # fetch/timeout/retry/concurrency, OFFLINE_MODE
│   └── sync/                # sync pipeline
│       ├── index.ts         # fast sync orchestration + merge
│       ├── malapi.ts        # malapi.io scraper (cache-first)
│       ├── mitre.ts         # MITRE STIX → techniques
│       ├── syscalls.ts      # j00ru NT/win32k CSV tables
│       ├── catalog.ts       # sdk-api index/materialize + description merge
│       ├── microsoft.ts     # learn.microsoft.com crawl + Requirements/Remarks
│       └── category-map.ts  # category → MITRE technique mapping
├── data/                    # LOCAL database (git-ignored, generated)
│   ├── functions.json       # merged function records
│   ├── techniques.json      # MITRE techniques
│   ├── catalog-index.json   # sdk-api tree index
│   ├── raw/                 # downloaded source cache
│   └── catalog/sdk-api/     # materialized sdk-api checkout
├── docs/                    # detailed documentation
└── ...
```

---

## Environment variables

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `SYNC_OFFLINE` | unset | `1` to forbid all network access in the sync pipeline (cache-only). |

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Fresh clone has zero functions | Run a sync: `POST /api/sync`, then optionally catalog + Microsoft enrichment. `data/` is git-ignored by design. |
| `start: sync...` says 409 conflict | A sync is already running — watch `GET /api/status` (`syncing` flag) and retry when it completes. |
| `audit...` placeholder errors | N/A (Python project note) — for WINAPI//CORE always non-empty results after a sync. |
| Catalog clones forever | The index uses `--filter=blob:none`; only `materialize:true` downloads blobs (several hundred MB). |
| Microsoft crawl seems stalled | Slow namespaces (e.g. `msacm`) hit the 25 s fetch timeout and are skipped — not cached, retried next run. It is resumable; re-run with `?limit=…`. |
| `SYNC_OFFLINE=1` and no cache | Sync stages no-op for missing sources — sync online at least once first. |

---

## Documentation

- [Architecture & internals](/docs/ARCHITECTURE.md) — pipeline design, caching, merge semantics, API contracts.
- [Security & responsible use](/SECURITY.md)

---

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 luel-4013.

---

*Dual-use note: this project consolidates publicly published offensive-security reference data and Microsoft documentation. Use it for defense, research, and authorized testing only.*