# WINAPI//CORE — Architecture & Internals

This document describes how the project is built, how the sync pipeline works, the merge semantics, the data persisted on disk, and the REST contracts. It is the companion to the README's quick overview.

---

## 1. Overview

WINAPI//CORE is a **single-page Next.js 15 (App Router) application with no external database**. All intelligence data lives as JSON files under `./data` and is produced by an in-process, cache-first sync pipeline.

```
┌───────────────────────────────────────────────────────────────┐
│  Browser UI (Explorer / Techniques / Saved / Data Core)        │
│        │  fetch()                                              │
│        ▼                                                       │
│  REST API (app/api/*)                                          │
│        │                                                       │
│  ┌─────┴────────────────────────────────────────────────────┐  │
│  │ lib/db.ts        — JSON store, status, caches (memory)    │  │
│  │ lib/sync/*       — background sync pipeline               │  │
│  │   malapi.ts      MITRE STIX                                │  │
│  │   syscalls.ts    j00ru CSV tables                          │  │
│  │   catalog.ts     MicrosoftDocs/sdk-api git tree            │  │
│  │   microsoft.ts   learn.microsoft.com crawler               │  │
│  └────────────────────────────────────────────────────────────┘  │
│        │  fs                                                     │
│        ▼                                                         │
│  data/functions.json   data/techniques.json                      │
│  data/catalog-index.json data/raw/*  data/catalog/sdk-api        │
└───────────────────────────────────────────────────────────────┘
```

### Key principles

1. **Cache-first** — every downloaded artifact (HTML page, CSV, STIX bundle, git tree) is persisted under `data/`. A later run with the same inputs reads from disk and makes **zero** network calls.
2. **Resumable** — sync stages iterate candidate work items and skip anything already cached. Interrupting a run loses at most the in-memory merges done since the last periodic save; nothing is re-downloaded.
3. **Offline-capable** — `SYNC_OFFLINE=1` forces every outbound fetch to throw, proving/forcing a cache-only workflow.
4. **Truthful attribution** — each function carries `sources` (which datasets contributed) and the derived `attacks` array is computed only from data the app actually holds (category + resolved MITRE technique names).

---

## 2. Data store & in-memory layer (`lib/db.ts`)

- **Files** (all under `data/`):

  | File | Contents |
  | ---- | -------- |
  | `functions.json` | `ApiFunction[]` — the master merged list. |
  | `techniques.json` | `Technique[]` — MITRE ATT&CK enterprise techniques. |
  | `catalog-index.json` | `CatalogEntry[]` — the sdk-api tree index (name, ns, path, learn URL, github URL, localDoc path). |
  | `status.json` | `SyncStatus` snapshot — stage, progress, log tail, counts, db size. |
  | `raw/` | Download cache, namespaced by source: `raw/malapi/*.html`, `raw/syscalls/*.csv`, `raw/mitre-enterprise-attack.json`, `raw/microsoft/ns#file.html`. |
  | `catalog/sdk-api/` | The `MicrosoftDocs/sdk-api` git checkout (blob-less unless materialized). |

- **In-memory caching**: `loadFunctions()` / `loadTechniques()` memoize parsed JSON in module-level variables (`funcsCache`, `techCache`). Writers (`saveFunctions`, `saveTechniques`) update the cache **and** write to disk atomically-ish via `JSON.stringify` + `writeFileSync`.

- **Status** is a single mutable object persisted on every change (`updateStatus`). It doubles as the failure record (`error` field) and the "last run" record (`cachedRun`, `completedAt`).

---

## 3. Fast sync pipeline (`lib/sync/index.ts`)

`runFastSync(force)`:

1. **MITRE** (`mitre.ts`) — downloads the enterprise-attack STIX bundle (~45 MB) once, extracts `attack-pattern` objects into `Technique[]` (id `T####`, tactics names normalized via `displayTactic`, sub-technique hierarchy via `T####.###`, ATT&CK URLs). Cached to `data/raw/mitre-enterprise-attack.json`. Re-index is possible from cache (`reindexMitreFromCache`).

2. **malapi.io** (`malapi.ts`) — fetches the homepage, parses the category table (`parseHomepage`) into `category → functions` listings, then concurrently (6 workers, 40 ms throttle) fetches each function page. Each page is parsed (`parsePage` — detail-container blocks: Function Name, Description, Library, Associated Attacks, Documentation). Pages are cached under `data/raw/malapi/<key>.html`. A tiny offline fallback map covers bot-blocked pages (`FALLBACK_PAGES`). `msToGithubUrl` derives the GitHub sdk-api source link and learn.microsoft link from the docs URL.

3. **Syscalls** (`syscalls.ts`) — fetches `nt.csv` + `win32k.csv` from `j00ru/windows-syscalls` (x64), caches them, and builds `ApiFunction`s with a compact `syscalls: { version → number }` map. `Zw`/`Nt` aliases generated.

4. **Merge**:
   - Start from malapi functions.
   - Merge catalog entries (`mergeCatalogFunctions`, section 4) if `catalog-index.json` exists.
   - Merge syscall tables: for an already-existing malapi/catalog function, copy the `syscalls` map and the source; for pure syscall functions, add them as new records.
   - Resolve technique refs against the MITRE list (fills missing name/tactic), compute `attacks`, dedupe technique refs, sort by name, save.

A fresh machine runs entirely on live fetches; a machine that has synced before runs entirely offline (check `allCached`).

---

## 4. Catalog (micro)merge (`lib/sync/catalog.ts`)

Two operations:

### `indexCatalog()`
- If `data/catalog/sdk-api/.git` is absent: `git clone --depth 1 --filter=blob:none --no-checkout --single-branch --branch docs`.
- Runs `git -C sdk-api ls-tree -r --name-only HEAD`, filters `content/<ns>/nf-*.md`, and builds `CatalogEntry` list:

  ```
  name    — from filename: nf-<ns>-<Name>.md → Name
  ns      — API namespace (e.g. fileapi)
  path    — repo-relative markdown path
  url     — https://learn.microsoft.com/en-us/windows/win32/api/<ns>/<file>   (no .md suffix)
  github  — raw GitHub blob URL
  localDoc — absolute path once materialized (`""` before)
  ```

  Writes `data/catalog-index.json`.

### `materializeCatalog()`
- Runs `git -C sdk-api checkout HEAD` — pulls all content blobs (several hundred MB). Sets `localDoc` to the absolute markdown path for every entry, re-writes the index.

### `readCatalogDoc(localPath)`
- Reads markdown, parses YAML frontmatter (`api_name`, `api_location`, `dll`, `description`, …) and falls back to the first `> 40`-char paragraph for the description (code blocks and markdown punctuation stripped).

### `mergeCatalogFunctions(entries, existing)`
- Case-insensitive key merge on existing functions: adds `catalog` to `sources`, appends alias, fills missing `description`/`dll`, dedupes the Microsoft Learn doc link (normalized without `.md`).
- New (non-existing) entries become fresh `catalog` records. Record count is thus the union of malapi + catalog + pure syscall functions.

---

## 5. Microsoft Learn enrichment (`lib/sync/microsoft.ts`)

- `learnUrlFor(fn)` — finds a learn.microsoft URL from `docsUrl` or `docs[]`, normalizes `docs.microsoft.com` → `learn.microsoft.com`, and strips any trailing `.md`. Matches the pattern:

  ```
  learn.microsoft.com/{en-us}/windows/win32/api/<ns>/<file>
  ```

- Cache: `data/raw/microsoft/<ns>#<file>.html` — stable per function, so the crawl is resumable and dedupe-able.

- `parseMsPage(html)` — pure HTML parse, **no inference**:
  - **Requirements table**: iterates all `table tr` rows reading `td,th` cells; field-name column (left cell — MS renders it as `<td><strong>…` in the value column for some pages) is matched by keyword to set: `platform`, `minClient`, `minServer`, `header`, `library`, `dll`.
  - **Remarks**: text of all nodes following the `h2/h3:contains("Remarks")` until the next heading, collapsed and truncated to 1200 chars.

- `runMsSync(force, limit)`:
  - Builds candidate URLs for all indexed functions, **sorts attack-relevant first** (functions with techniques).
  - Unless `force`, only targets whose cache file does **not** exist are considered; `limit` restricts the current run to the first N (for chunked crawling).
  - Fetches with 4-way concurrency, 25 s timeout, 80 ms throttle. Cached HTML is always reused even under `force` (force = re-parse, not re-download).
  - Merges `req` into `fn.ms`, back-fills `dll` when previously `Unknown`. Periodic save every 100 pages; final save + `ready` + `microsoftStage: done`. Logs every skip (non-200/abort) — skips are not cached, so they retry next run.

- `enrichFromMsCache(functions)` — a pure-cache re-merge helper that applies parsed pages to a loaded function array with zero network.

---

## 6. Offline mode (`lib/http.ts`)

- `OFFLINE_MODE = process.env.SYNC_OFFLINE === "1"`.
- `fetchText`/`fetchBuffer` throw `offline mode …` immediately when set. Cached reads happen *before* these are reached, so sync still works from local copies.
- `fetchText` is the general network helper: configurable timeout (default 30 s), retry loop (default 2 retries, backoff 1.2 s), realistic browser User-Agent, redirect-follow.
- `withConcurrency` is the small worker-pool used by malapi and microsoft crawls.

---

## 7. REST API contracts

### `GET /api/functions`
Query params (`URLSearchParams`):
`q` (AND across name/dll/description/categories), `category`, `dll`, `technique` (T-id), `tactic`, `source` (malapi|nt-native|win32k|catalog), `ids` (explicit comma list), `page` (1-based), `perPage` (≤200, default 60).

Response:
```json
{
  "items": [ApiFunction],
  "total": 1234,
  "page": 1, "perPage": 60, "totalPages": 21,
  "facets": { "categories": [...], "dlls": [...], "tactics": [...], "sources": [...] }
}
```
Facets are computed over the *filtered* set, before pagination. DLL facet capped at 50 entries.

### `GET /api/functions/:id`
Full record; matches on normalized `id` or exact `name`. 404 otherwise.

### `GET /api/functions/:id/doc`
Requires `localDoc` (materialized catalog). Returns frontmatter-derived `{ description, dll, apiName, title }`.

### `GET /api/techniques`
`q` (name/id/tactic), `tactic`, `page`, `perPage` (≤500, default 100). Items include computed `functionCount`. Response includes `tactics` unique list.

### `GET /api/techniques/:id`
Returns the technique `{...Tech, functions: ApiFunction[]}` where `functions` = all mapped functions.

### `GET /api/meta`
Global unfiltered facet totals + `status`, + catalog count.

### `GET /api/status`
`SyncStatus`: `ready`, `syncing`, `stage`, `progress` (0–1), `dataDir`, `dataSize` (bytes), `cachedRun`, `log` (last 200 `{t,msg}`), `startedAt`, `completedAt`, `error`, `catalogStage`, `microsoftStage`, `counts` (malapi, natives, syscalls, win32k, catalog, microsoft, techniques).

### `POST /api/sync` · `DELETE /api/sync`
Fast sync (optionally `?force=1`); DELETE resets status. 409 if already running.

### `POST /api/sync/catalog`
Body `{ materialize: boolean }`. 409 if catalog sync running.

### `POST /api/sync/microsoft` · `DELETE /api/sync/microsoft`
`?limit=N&force=1`. 409 if running; DELETE resets status.

---

## 8. UI layer

- `components/AppShell` — layout + nav (Explorer / Techniques / Saved / Data Core).
- `components/lib/status-context` — polls `/api/status` every 2.5 s, exposes `SyncStatus` to the whole tree. Pages use `export const dynamic = "force-dynamic"` so status is never static-prerendered.
- `components/ExplorerView` — search box, facet bars, paginated `FunctionCard` grid → `DetailDrawer`.
- `components/DetailDrawer` — full record: aliases, sources badges, categories, technique chips → techniques view, syscall table per version, docs links, and the rendered `ms` Requirements/Remarks card when available.
- `components/SyncView` ("Data Core") — db path/size, live stage progress bar, source stat cards, and the three sync action buttons (fast / catalog index / catalog materialize / microsoft with optional limit). It drives the same state you can drive over the API.
- `components/SavedView` — browser-`localStorage` pinned collection.
- `components/TechniquesView` — MITRE browse: tactics groups, sub-technique trees, function links.

---

## 9. Concurrency & throttling

| Source | Workers | Throttle/timeout |
| ------ | ------- | ---------------- |
| malapi.io pages | 6 | 40 ms sleep / 25 s timeout |
| learn.microsoft.com | 4 | 80 ms sleep / 25 s timeout ×1 retry |
| MITRE STIX | 1 | 300 s timeout |
| syscall CSVs | 1 | 60 s timeout |
| catalog clone | 1 | git (maxBuffer 64 MB) |

---

## 10. Known limitations & design notes

- **Database is at-least-once, not transactional.** Interrupting a sync can leave `functions.json` mid-merge only up to the last 100-page save — rerun the sync to converge.
- **`blob:none` clone requires network once.** The catalog index caches the `catalog-index.json`; the git dir itself is only needed for materialization/re-index.
- **`ms` enrichment covers functions with learn URLs.** Some documented pages are non-API pages (macros/structs) and are skipped by the `nf-` LS tree filter.
- **Local browser storage** (`SavedView`) is per-device, not shared.
- All scraped content is treated as untrusted HTML; parsed via cheerio text/node extraction only (no script execution).