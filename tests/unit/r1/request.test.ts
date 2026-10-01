// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clientIp, createIpLimiter, isJsonContentType, isSameOrigin, readCappedText } from "@/lib/community/request";

const h = (init: Record<string, string>) => new Headers(init);

describe("isSameOrigin", () => {
  it("needs an Origin whose host equals the request host", () => {
    expect(isSameOrigin(h({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(h({ origin: "https://app.example", host: "app.example", "x-forwarded-host": "app.example" }))).toBe(true);
    expect(isSameOrigin(h({ origin: "https://evil.example", host: "app.example" }))).toBe(false);
    expect(isSameOrigin(h({ host: "app.example" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "null", host: "app.example" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "http://localhost:3000" }))).toBe(false);
  });
});

describe("isJsonContentType", () => {
  it("accepts application/json with a charset and nothing else", () => {
    expect(isJsonContentType(h({ "content-type": "application/json" }))).toBe(true);
    expect(isJsonContentType(h({ "content-type": "application/json; charset=utf-8" }))).toBe(true);
    expect(isJsonContentType(h({ "content-type": "text/plain" }))).toBe(false);
    expect(isJsonContentType(h({ "content-type": "multipart/form-data; boundary=x" }))).toBe(false);
    expect(isJsonContentType(h({}))).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry, and nothing else", () => {
    expect(clientIp(h({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(h({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("createIpLimiter", () => {
  it("allows `limit` in the window and starts a new window after it", () => {
    const l = createIpLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => l.allow("a", 0))).toEqual([true, true, true, false]);
    expect(l.allow("b", 0)).toBe(true);
    expect(l.allow("a", 999)).toBe(false);
    expect(l.allow("a", 1000)).toBe(true);
  });

  it("stays bounded", () => {
    const l = createIpLimiter(1, 1000, 10);
    for (let i = 0; i < 50; i++) l.allow(`ip-${i}`, 0);
    expect(l.allow("fresh", 0)).toBe(true);
  });
});

describe("readCappedText", () => {
  it("returns the text, or null once over the cap", async () => {
    const ok = new Request("http://x.test", { method: "POST", body: "hello" });
    expect(await readCappedText(ok, 10)).toBe("hello");
    const big = new Request("http://x.test", { method: "POST", body: "x".repeat(11) });
    expect(await readCappedText(big, 10)).toBeNull();
  });
});
