import type { Tool } from "@/lib/contracts";

export type { Tool };
export const TOOLS: readonly Tool[] = ["claude", "codex"] as const;

export const TOOL_LABEL: Record<Tool, string> = { claude: "Claude Code", codex: "Codex CLI" };

/** Exact lowercase match only (AMB-C7). With a repeated param the first value wins. */
export function parseTool(value: string | string[] | undefined | null): Tool | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "claude" || v === "codex" ? v : null;
}
