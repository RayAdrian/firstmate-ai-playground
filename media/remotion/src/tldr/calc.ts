// Browser side of the TL;DR composition: loads Satoshi, measures the real text with @remotion/layout-utils and
// builds the plan (beats plus fitted lines). Runs in calculateMetadata, so an over-long bullet fails the render
// (selectComposition rejects) before any frame is drawn. Throws name the lesson slug and the bullet index.
import { loadFont } from "@remotion/fonts";
import { measureText } from "@remotion/layout-utils";
import type { CalculateMetadataFunction } from "remotion";
import { staticFile } from "remotion";
import { font } from "../theme.ts";
import { buildBeats, FPS, HEIGHT, WIDTH, TOOL_LABEL } from "./beats.ts";
import type { Beat, TldrInput } from "./beats.ts";
import { fitCode, fitPoint, fitRecapCode, fitRecapPoint, fitTitle } from "./wrap.ts";
import type { Fitted, Measure } from "./wrap.ts";

export type Entry = {
  tool: "all" | "claude" | "codex";
  kind: "command" | "prompt";
  text: string;
  /** Code-block label: "Terminal" / "Prompt" for a shared entry, the tool name for a per-tool one. */
  label: string;
  fit: Fitted;
  recapFit: Fitted;
};

export type Plan = {
  beats: Beat[];
  titleFit: Fitted;
  pointFits: Fitted[];
  recapPointFits: Fitted[];
  entries: Entry[];
};

export type TldrProps = { slug: string; title: string; tldr: TldrInput; plan?: Plan };

let fontsReady: Promise<unknown> | undefined;
export const ensureFonts = () => {
  fontsReady ??= Promise.all(
    [
      ["Satoshi-Regular.woff2", "400"],
      ["Satoshi-Medium.woff2", "500"],
      ["Satoshi-Bold.woff2", "700"],
    ].map(([file, weight]) => loadFont({ family: "Satoshi", url: staticFile(file), weight })),
  );
  return fontsReady;
};

const measureWith =
  (sansWeight: "500" | "700"): Measure =>
  (text, code, size) =>
    code
      ? measureText({ text, fontFamily: font.mono, fontSize: size, fontWeight: "400", validateFontIsLoaded: false }).width
      : measureText({ text, fontFamily: "Satoshi", fontSize: size, fontWeight: sansWeight, validateFontIsLoaded: true }).width;

export const calculateMetadata: CalculateMetadataFunction<TldrProps> = async ({ props }) => {
  await ensureFonts();
  const { slug, title, tldr } = props;
  const medium = measureWith("500");
  const bold = measureWith("700");
  const { beats, frames } = buildBeats(title, tldr);

  const tt = tldr.try_this;
  const raw = "all" in tt
    ? [{ tool: "all" as const, ...tt.all, label: tt.all.kind === "command" ? "Terminal" : "Prompt" }]
    : (["claude", "codex"] as const).map((tool) => ({ tool, ...tt[tool], label: TOOL_LABEL[tool] }));

  const plan: Plan = {
    beats,
    titleFit: fitTitle(slug, title, bold),
    pointFits: tldr.points.map((p, i) => fitPoint(slug, i, p, medium)),
    recapPointFits: tldr.points.map((p, i) => fitRecapPoint(slug, i, p, medium)),
    entries: raw.map((e) => ({
      ...e,
      fit: fitCode(slug, `Try this (${e.tool}) code`, e.text, medium),
      recapFit: fitRecapCode(slug, `Try this (${e.tool}) code`, e.text, medium),
    })),
  };
  // End card, right column: "Try this" (40) then one block per entry (32 label + 16 padding + code lines), 12 apart.
  // The column starts at y 112 and nothing may pass y 560 (DESIGN §6.3.4 safe areas).
  const colH = 40 + plan.entries.reduce((h, e) => h + 12 + 32 + 16 + e.recapFit.lines.length * 34, 0);
  if (112 + colH > 560) {
    throw new Error(
      `TL;DR fit check failed for lesson "${slug}": the Try this block(s) on the end card end at y ${112 + colH}, past the y 560 safe line. Shorten the Try this text in the lesson's tldr frontmatter.`,
    );
  }
  return { durationInFrames: frames, fps: FPS, width: WIDTH, height: HEIGHT, props: { ...props, plan } };
};
