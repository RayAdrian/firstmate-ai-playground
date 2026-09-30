"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button, Notice } from "@/components/ui";
import { useProgressStatus } from "./hooks";

const GLOBAL_SELECTOR = '[data-progress-notices="global"]';

const noopSubscribe = () => () => {};
const globalMounted = () => document.querySelector(GLOBAL_SELECTOR) !== null;
const notMountedOnServer = () => false;

function focusMainHeading(): void {
  const target =
    document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("main");
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus();
}

/**
 * The two global progress banners (DESIGN §4.11): "Progress can't be saved in this browser"
 * (P-3, not dismissible) and "Saved progress was unreadable and has been reset" (P-2, dismissible).
 * Client-only: nothing renders until the store has hydrated.
 *
 * Mount `<ProgressNotices />` once in the app shell's GlobalNotices slot. Pages that must show the
 * banners even without the shell (/progress, /bookmarks) render `<ProgressNotices fallback />`,
 * which stays empty whenever the global instance is present.
 */
export function ProgressNotices({ fallback = false }: { fallback?: boolean }) {
  const { hydrated, storageAvailable, corruptNotice, dismissCorruptNotice } = useProgressStatus();
  const hasGlobal = useSyncExternalStore(noopSubscribe, globalMounted, notMountedOnServer);
  const suppressed = fallback && hasGlobal;

  let content: React.ReactNode = null;
  if (hydrated && !suppressed) {
    if (!storageAvailable) {
      content = (
        <Notice tone="warning">
          <p>
            <strong>Progress can&apos;t be saved in this browser.</strong> Everything still works for
            this visit. Private windows and blocked site data prevent saving.
          </p>
        </Notice>
      );
    } else if (corruptNotice) {
      content = (
        <Notice tone="warning">
          <div className="flex items-start justify-between gap-3">
            <p>
              <strong>Saved progress was unreadable and has been reset.</strong> If you exported a
              backup, you can import it on the{" "}
              <Link href="/progress" className="underline">
                Progress page
              </Link>
              .
            </p>
            <Button
              aria-label="Dismiss"
              onClick={() => {
                dismissCorruptNotice();
                focusMainHeading();
              }}
            >
              Dismiss
            </Button>
          </div>
        </Notice>
      );
    }
  }

  return <div data-progress-notices={fallback ? "page" : "global"}>{content}</div>;
}
