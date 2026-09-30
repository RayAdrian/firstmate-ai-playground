// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonicalize, InvalidUrlError } from "../../../scripts/news/canonical";

describe("canonicalize (I-2.1, TC-E-15)", () => {
  const table: Array<[string, string]> = [
    ["https://OpenAI.com/Index/GPT", "https://openai.com/Index/GPT"],
    ["https://a.com/p?utm_source=x&utm_medium=y&utm_campaign=z&id=3", "https://a.com/p?id=3"],
    ["https://a.com/p?ref=hn", "https://a.com/p"],
    ["https://a.com/p?fbclid=abc&gclid=def", "https://a.com/p"],
    ["https://a.com/p#section-2", "https://a.com/p"],
    ["https://a.com/p/", "https://a.com/p"],
    ["https://a.com/", "https://a.com"],
    ["https://a.com/p?utm_source=x", "https://a.com/p"],
    ["https://a.com/p?referrer=x", "https://a.com/p?referrer=x"],
    ["https://a.com/p?b=2&a=1", "https://a.com/p?b=2&a=1"],
    ["https://a.com:443/p", "https://a.com/p"],
    ["https://bücher.example/p", "https://xn--bcher-kva.example/p"],
    ["https://a.com/p/?utm_source=x#top", "https://a.com/p"],
  ];
  it.each(table)("%s -> %s", (input, expected) => {
    expect(canonicalize(input)).toBe(expected);
  });

  it("keeps http and https distinct", () => {
    expect(canonicalize("http://a.com/p")).not.toBe(canonicalize("https://a.com/p"));
  });

  it("throws a typed error for garbage and non-http schemes", () => {
    expect(() => canonicalize("not a url")).toThrow(InvalidUrlError);
    expect(() => canonicalize("javascript:alert(1)")).toThrow(InvalidUrlError);
    expect(() => canonicalize("ftp://a.com/x")).toThrow(InvalidUrlError);
  });

  it("is idempotent", () => {
    for (const [input] of table) {
      const once = canonicalize(input);
      expect(canonicalize(once)).toBe(once);
    }
  });
});
