export const DEFAULT_FETCH_TIMEOUT_MS = 20_000;
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export type FetchFailure = "timeout" | "redirect" | "too large" | `http ${number}` | "network";

export class FetchError extends Error {
  constructor(
    readonly reason: FetchFailure,
    detail?: string,
  ) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "FetchError";
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  /** Cap on the DECODED body, so a gzip bomb is stopped as it inflates. */
  maxBytes?: number;
  /** Test seam: replaces the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface RetryDeps {
  sleep?: (ms: number) => Promise<void>;
  log?: { info: (msg: string) => void };
}

/** Attempts per fetch and the wait before attempts 2 and 3. Worst case is 3 x timeout + 4s per source. */
export const MAX_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS: readonly number[] = [1000, 3000];

function isYouTubeFeed(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.hostname === "youtube.com" || u.hostname.endsWith(".youtube.com")) && u.pathname.startsWith("/feeds/");
  } catch {
    return false;
  }
}

/** 5xx is retried for any source. 404 is retried only for youtube.com feeds, where it is known to be transient. */
export function isRetryable(url: string, err: unknown): boolean {
  if (!(err instanceof FetchError)) return false;
  if (/^http 5\d\d$/.test(err.reason)) return true;
  return err.reason === "http 404" && isYouTubeFeed(url);
}

/** fetchBytes with up to MAX_ATTEMPTS attempts and short backoff on transient failures. */
export async function fetchBytesWithRetry(
  url: string,
  options: FetchOptions = {},
  deps: RetryDeps = {},
): Promise<{ bytes: Uint8Array; contentType: string | undefined }> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchBytes(url, options);
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isRetryable(url, err)) throw err;
      const wait = RETRY_BACKOFF_MS[attempt - 1] ?? 3000;
      let host = "source";
      try {
        host = new URL(url).host;
      } catch {
        // keep generic label
      }
      deps.log?.info(`fetch ${host} failed (${(err as FetchError).reason}), retry ${attempt}/${MAX_ATTEMPTS - 1} in ${wait}ms`);
      await sleep(wait);
    }
  }
}

/** GET a URL with a total timeout, redirect limit and streaming size cap. Only http(s). */
export async function fetchBytes(url: string, options: FetchOptions = {}): Promise<{ bytes: Uint8Array; contentType: string | undefined }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new FetchError("network", "invalid url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new FetchError("network", "unsupported scheme");

  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const res = await (options.fetchImpl ?? fetch)(parsed, {
      signal,
      redirect: "follow",
      headers: {
        "user-agent": "fm-playground-news/1.0 (+https://firstmate.tech)",
        accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
      },
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new FetchError(`http ${res.status}` as FetchFailure);
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new FetchError("too large", `> ${maxBytes} bytes`);
        }
        chunks.push(value);
      }
    }
    return { bytes: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? undefined };
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if (signal.aborted || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))) throw new FetchError("timeout");
    const causeMsg = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
    if (/redirect/i.test(err instanceof Error ? err.message : "") || /redirect/i.test(causeMsg)) throw new FetchError("redirect");
    throw new FetchError("network", causeMsg || (err instanceof Error ? err.message : "fetch failed"));
  }
}
