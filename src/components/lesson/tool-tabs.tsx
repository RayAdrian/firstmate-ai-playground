"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Asterisk, Hexagon } from "lucide-react";
import { Tabs } from "@/components/ui";
import { useToolPref } from "@/lib/progress";
import { TOOLS, TOOL_LABEL, type Tool } from "./tool";

// One shared tool selection for every tablist on the page (lesson tabs and starter-prompt tabs).
// Rules (DESIGN 4.4): the server renders the ?tool value (or Claude); on mount, with no valid
// ?tool, a saved "codex" preference switches the page (and rewrites the URL with replaceState);
// an explicit ?tool wins and never overwrites the preference; a user choice updates all of them.

type ToolContextValue = { tool: Tool; select: (tool: Tool) => void };
const ToolContext = createContext<ToolContextValue | null>(null);

function writeToolToUrl(tool: Tool): void {
  const url = new URL(window.location.href);
  url.searchParams.set("tool", tool);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function ToolProvider({
  initialTool,
  hasUrlTool,
  children,
}: {
  /** The tab the server rendered: the valid ?tool value, else "claude". */
  initialTool: Tool;
  /** True when the request carried a valid ?tool value. */
  hasUrlTool: boolean;
  children: ReactNode;
}) {
  const { hydrated, tool: pref, setTool: savePref } = useToolPref();
  const [chosen, setChosen] = useState<Tool | null>(null);

  const fromPref = !hasUrlTool && hydrated && pref === "codex";
  const tool: Tool = chosen ?? (fromPref ? "codex" : initialTool);

  const syncedUrl = useRef(false);
  useEffect(() => {
    if (fromPref && !syncedUrl.current) {
      syncedUrl.current = true;
      writeToolToUrl("codex");
    }
  }, [fromPref]);

  const select = useCallback(
    (next: Tool) => {
      setChosen(next);
      savePref(next);
      writeToolToUrl(next);
    },
    [savePref],
  );

  const value = useMemo(() => ({ tool, select }), [tool, select]);
  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
}

export function useTool(): ToolContextValue {
  const ctx = useContext(ToolContext);
  if (!ctx) throw new Error("useTool must be used inside <ToolProvider>");
  return ctx;
}

const ICONS: Record<Tool, ReactNode> = {
  claude: <Asterisk aria-hidden="true" />,
  codex: <Hexagon aria-hidden="true" />,
};

/** The shared Claude Code / Codex CLI tabs: WS-A's controlled Tabs bound to the page-wide tool. */
export function ToolTabs({
  scope,
  label,
  panels,
}: {
  /** Makes ids unique per tablist: tab-{scope}-{tool} / panel-{scope}-{tool}. */
  scope: string;
  label: string;
  panels: Record<Tool, ReactNode>;
}) {
  const { tool, select } = useTool();
  return (
    <Tabs
      scope={scope}
      label={label}
      value={tool}
      onValueChange={(id) => select(id as Tool)}
      items={TOOLS.map((t) => ({ id: t, label: TOOL_LABEL[t], icon: ICONS[t], content: panels[t] }))}
    />
  );
}
