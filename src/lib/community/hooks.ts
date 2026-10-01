"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Community } from "@/lib/contracts";
import { useProgressState } from "@/lib/progress/hooks";
import {
  EMPTY_ENTRY,
  acquire,
  getEntry,
  getErrorLine,
  getPrompt,
  subscribe,
  type Entry,
  type ErrorLine,
  type Prompt,
} from "./store";

/** This workflow's toggle state. Server render and the first client render are the empty (unpressed, not loaded) entry. */
export function useCommunityEntry(slug: string): Entry {
  const { hydrated } = useProgressState();
  useEffect(() => {
    if (!hydrated) return;
    return acquire(slug);
  }, [hydrated, slug]);
  return useSyncExternalStore(
    subscribe,
    () => getEntry(slug),
    () => EMPTY_ENTRY,
  );
}

export function useNamePrompt(): Prompt | null {
  return useSyncExternalStore(subscribe, getPrompt, () => null);
}

export function useCommunityError(slug: string): ErrorLine | null {
  return useSyncExternalStore(
    subscribe,
    () => getErrorLine(slug),
    () => null,
  );
}

/** This browser's name (client-only; `hydrated` is false until localStorage has been read, P-5). */
export function useCommunityIdentity(): { hydrated: boolean; community: Community } {
  const { hydrated, state } = useProgressState();
  return { hydrated, community: state.community };
}
