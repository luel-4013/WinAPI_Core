const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** When set, all outbound fetches throw — used to prove/force offline cache-only mode. */
export const OFFLINE_MODE = process.env.SYNC_OFFLINE === "1";

export async function fetchText(url: string, timeoutMs = 30_000, retries = 2): Promise<string> {
  let last: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      if (OFFLINE_MODE) throw new Error(`offline mode (SYNC_OFFLINE=1) — refused ${url}`);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (e) {
      last = e as Error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  throw last;
}

export async function fetchBuffer(url: string, timeoutMs = 120_000): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (OFFLINE_MODE) throw new Error(`offline mode (SYNC_OFFLINE=1) — refused ${url}`);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const cur = i++;
      try {
        await fn(items[cur], cur);
      } catch (e) {
        console.warn(`concurrency task ${cur} failed`, e);
      }
    }
  });
  await Promise.all(workers);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}