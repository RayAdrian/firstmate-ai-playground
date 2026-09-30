import type { Env } from "./env";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export class SourcesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcesConfigError";
  }
}

const httpUrl = z.url({ protocol: /^https?$/ });

export const sourceConfigSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be kebab-case"),
  url: httpUrl,
  type: z.enum(["rss", "atom", "html"]),
  enabled: z.boolean(),
  filters: z
    .object({ keywords: z.array(z.string().min(1)).optional() })
    .catchall(z.unknown())
    .default({}),
});

export interface SourceConfig {
  name: string;
  slug: string;
  url: string;
  type: "rss" | "atom" | "html";
  enabled: boolean;
  filters: { keywords?: string[]; [key: string]: unknown };
}

/** Repo root: scripts/news/ is two levels down. */
export const REPO_ROOT = path.resolve(__dirname, "../..");

export function sourcesPath(env: Env = process.env): string {
  return env.NEWS_SOURCES_PATH ?? path.join(REPO_ROOT, "content/news/sources.yaml");
}

export function parseSources(text: string, file: string): SourceConfig[] {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    throw new SourcesConfigError(`${file}: not valid YAML (${err instanceof Error ? err.message.split("\n")[0] : "parse error"})`);
  }
  if (!Array.isArray(raw)) throw new SourcesConfigError(`${file}: expected a list of sources`);
  const out: SourceConfig[] = [];
  const seen = new Set<string>();
  raw.forEach((entry, index) => {
    const parsed = sourceConfigSchema.safeParse(entry);
    const label = typeof (entry as { slug?: unknown } | null)?.slug === "string" ? (entry as { slug: string }).slug : `#${index}`;
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new SourcesConfigError(`${file}: entry ${label}: field ${issue.path.join(".") || "(entry)"}: ${issue.message}`);
    }
    if (seen.has(parsed.data.slug)) {
      throw new SourcesConfigError(`${file}: entry ${label}: field slug: duplicate slug "${parsed.data.slug}"`);
    }
    seen.add(parsed.data.slug);
    out.push(parsed.data);
  });
  return out;
}

export function loadSources(file: string = sourcesPath()): SourceConfig[] {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new SourcesConfigError(`${file}: cannot read sources file`);
  }
  return parseSources(text, file);
}
