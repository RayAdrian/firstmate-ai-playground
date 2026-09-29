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
    const res = await fetch(parsed, {
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
