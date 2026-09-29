"use client";

// Single-line command with a copy button (DESIGN 4.5 CommandLine). Local to the news module until
// WS-A's shared CommandLine lands; swap the import then. Client boundary: clipboard + state.
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { announce } from "@/lib/progress";

const isMac = (): boolean => /mac/i.test(typeof navigator === "undefined" ? "" : navigator.platform);

export function CopyCommand({ command, label = "Terminal" }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(command);
      setBlocked(false);
      setCopied(true);
      announce("Copied");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = codeRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setBlocked(true);
      announce(`Copy blocked. Code selected. Press ${isMac() ? "⌘C" : "Ctrl+C"} to copy.`);
    }
  };

  return (
    <figure
      data-code-chrome
      className="my-3 max-w-full overflow-hidden rounded-xl border border-code-border bg-code-bg"
    >
      <div className="flex h-10 items-center justify-between bg-code-header px-3">
        <figcaption className="font-mono text-xs font-medium text-code-muted">{label}</figcaption>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-code-fg hover:bg-white/10 pointer-coarse:h-11 pointer-coarse:min-w-11"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          {copied ? (
            "Copied"
          ) : (
            <>
              Copy<span className="sr-only"> code: {label}</span>
            </>
          )}
        </button>
      </div>
      <pre tabIndex={0} aria-label={`Code: ${label}`} className="overflow-x-auto p-4 text-sm leading-6 text-code-fg">
        <code ref={codeRef}>{command}</code>
      </pre>
      {blocked ? (
        <p className="border-t border-code-border bg-code-header px-3 py-2 text-sm text-code-fg">
          Press {isMac() ? "⌘C" : "Ctrl+C"} to copy
        </p>
      ) : null}
    </figure>
  );
}
