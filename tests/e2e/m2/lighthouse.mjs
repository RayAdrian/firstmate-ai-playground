#!/usr/bin/env node
// Lighthouse (mobile preset) against a running production server: `next build && next start --port <p>`.
//   node tests/e2e/m2/lighthouse.mjs http://localhost:3466 [runs=3]      (mobile, the default)
//   LH_PRESET=desktop node tests/e2e/m2/lighthouse.mjs http://localhost:3466   (TC-M2-31: LCP < 2.0s on desktop)
// Uses `npx lighthouse` (not a project dependency) and Playwright's Chromium. Prints the median LCP/CLS/TBT and the
// category scores per URL, and writes the raw reports to $LH_OUT (default: os.tmpdir()/fm-lighthouse).
// Start the server with FM_TEST_MODE=1 so the fm_test_now clock cookie is honoured; without it the digest is
// "Latest" once the fixtures' day has passed. Run `npm run db:reset:test` first.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3466";
const runs = Number(process.argv[3] ?? 3);
const out = process.env.LH_OUT ?? path.join(os.tmpdir(), "fm-lighthouse");
mkdirSync(out, { recursive: true });

const PAGES = ["/", "/curriculum", "/lessons/l1-first-session", "/news"];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const rows = [];
for (const route of PAGES) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const file = path.join(out, `${route.replaceAll("/", "_") || "_"}-${i}.json`);
    const res = spawnSync(
      "npx",
      [
        "-y",
        "lighthouse",
        `${base}${route}`,
        "--output=json",
        `--output-path=${file}`,
        "--quiet",
        ...(process.env.LH_PRESET === "desktop" ? ["--preset=desktop"] : []),
        "--chrome-flags=--headless=new --no-sandbox",
        "--only-categories=performance,accessibility,best-practices,seo",
      ],
      { encoding: "utf8", env: { ...process.env, CHROME_PATH: chromium.executablePath() } },
    );
    if (res.status !== 0) {
      console.error(res.stderr);
      process.exit(res.status ?? 1);
    }
    const lhr = JSON.parse(readFileSync(file, "utf8"));
    samples.push({
      lcp: lhr.audits["largest-contentful-paint"].numericValue,
      cls: lhr.audits["cumulative-layout-shift"].numericValue,
      tbt: lhr.audits["total-blocking-time"].numericValue,
      perf: lhr.categories.performance.score * 100,
      a11y: lhr.categories.accessibility.score * 100,
      bp: lhr.categories["best-practices"].score * 100,
      seo: lhr.categories.seo.score * 100,
    });
  }
  rows.push({
    route,
    LCP_ms: Math.round(median(samples.map((s) => s.lcp))),
    CLS: Number(median(samples.map((s) => s.cls)).toFixed(3)),
    TBT_ms: Math.round(median(samples.map((s) => s.tbt))),
    performance: median(samples.map((s) => s.perf)),
    accessibility: median(samples.map((s) => s.a11y)),
    best_practices: median(samples.map((s) => s.bp)),
    seo: median(samples.map((s) => s.seo)),
  });
}
console.table(rows);
