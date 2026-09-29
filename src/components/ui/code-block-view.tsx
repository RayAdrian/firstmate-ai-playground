"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "./cn";
import { announce } from "./live-region";

const COPIED_MS = 2000;
const HINT_MIN_MS = 8000;

type NavigatorWithUAData = Navigator & { userAgentData?: { platform?: string } };

function copyShortcut(): string {
  const nav = navigator as NavigatorWithUAData;
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad/i.test(platform) ? "⌘C" : "Ctrl+C";
}

/**
 * The chrome around a code block (DESIGN.md §4.5): header label, Copy button, clipboard-denied fallback,
 * and the focusable scroll area. `children` is the (already highlighted) <code> content, rendered on the server.
 * `raw` is the source text that gets copied, never the DOM text of the highlighted tree.
 */
export function CodeBlockView({
  label,
  raw,
  children,
  className,
}: {
  label: string;
  raw: string;
  children: ReactNode;
  className?: string;
}) {
  const captionId = useId();
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const figureRef = useRef<HTMLElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  const hintTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(copiedTimer.current);
      window.clearTimeout(hintTimer.current);
    },
    [],
  );

  // The hint stays until the next click outside the block or 8s, whichever is later.
  useEffect(() => {
    if (!hint) return;
    let timeElapsed = false;
    let clickedOutside = false;
    const maybeHide = () => {
      if (timeElapsed && clickedOutside) setHint(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (figureRef.current?.contains(e.target as Node)) return;
      clickedOutside = true;
      maybeHide();
    };
    hintTimer.current = window.setTimeout(() => {
      timeElapsed = true;
      maybeHide();
    }, HINT_MIN_MS);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.clearTimeout(hintTimer.current);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [hint]);

  const showCopied = () => {
    setHint(null);
    setCopied(true);
    announce("Copied");
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  const fallBack = () => {
    const pre = preRef.current;
    const code = pre?.querySelector("code");
    if (pre && code) {
      // Focus first: moving focus can reset the selection in some engines, and the selection must be live for Cmd/Ctrl+C.
      pre.focus();
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    const shortcut = copyShortcut();
    setCopied(false);
    setHint(`Press ${shortcut} to copy`);
    announce(`Copy blocked. Code selected. Press ${shortcut} to copy.`);
  };

  const onCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(raw);
      showCopied();
    } catch {
      fallBack();
    }
  };

  return (
    <figure
      ref={figureRef}
      aria-labelledby={captionId}
      data-code-chrome
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-xl border border-code-border bg-code-bg text-code-fg",
        className,
      )}
    >
      <div className="flex h-10 items-center justify-between bg-code-header px-3">
        <figcaption id={captionId} className="font-mono text-xs font-medium text-code-muted">{label}</figcaption>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-code-fg transition-colors duration-[var(--fm-duration-fast)] hover:bg-white/10 touch:h-11"
        >
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? (
            "Copied"
          ) : (
            <>
              Copy{" "}
              <span className="sr-only">code: {label}</span>
            </>
          )}
        </button>
      </div>
      {hint ? (
        <p className="border-t border-code-border bg-code-header px-3 py-2 text-sm text-code-fg">{hint}</p>
      ) : null}
      <pre
        ref={preRef}
        tabIndex={0}
        aria-label={`Code: ${label}`}
        className="overflow-x-auto p-4 font-mono text-[0.875rem] leading-6 text-code-fg"
      >
        {children}
      </pre>
    </figure>
  );
}
