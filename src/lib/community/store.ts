import { announce } from "@/components/ui/live-region";
import { COMMUNITY_MAX_SLUGS, REACTION_KEYS, normalizeDisplayName, type ReactionKey } from "@/lib/contracts";
import { getState, updateProgress } from "@/lib/progress/store";
import { postCommunity, type CommunityFailure } from "./client";

/**
 * Client state for stars and reactions (PRD 18.5 CM-5, CM-6). A tiny external store keyed by workflow slug, shared by
 * every control that shows the same workflow (the header Star, the reaction bar, a card Star).
 *
 * Each toggle keeps three booleans:
 *  - `base`      what this browser had when the server-rendered counts were produced (from `mine`),
 *  - `confirmed` the last state the server acknowledged,
 *  - `desired`   what the person last asked for (shown at once: optimistic).
 * The count on screen is `serverCount + desired - base`, so it never double-counts.
 * Requests carry the DESIRED state, never "toggle", and only the latest desired state is ever sent after a burst.
 */

export type Flag = { base: boolean; confirmed: boolean; desired: boolean; inflight: boolean };
export type Target = "star" | ReactionKey;
export type Entry = { loaded: boolean; star: Flag; reactions: Readonly<Record<ReactionKey, Flag>> };
export type Prompt = { slug: string; kind: "star" | "react"; trigger: HTMLElement | null };
export type ErrorLine = { slug: string; text: string };

const FLAG_OFF: Flag = { base: false, confirmed: false, desired: false, inflight: false };
const flagFrom = (on: boolean): Flag => ({ base: on, confirmed: on, desired: on, inflight: false });

export const EMPTY_ENTRY: Entry = {
  loaded: false,
  star: FLAG_OFF,
  reactions: { worked: FLAG_OFF, learned: FLAG_OFF, saved_time: FLAG_OFF, game_changer: FLAG_OFF },
};

/** What the count on screen is: the server's count with this browser's own change applied once. */
export function displayCount(serverCount: number, flag: Flag): number {
  return Math.max(0, serverCount + (flag.desired ? 1 : 0) - (flag.base ? 1 : 0));
}

export const MESSAGES = {
  star: "Couldn't save your star. Try again.",
  react: "Couldn't save your reaction. Try again.",
  limited: "Too many changes. Wait a minute and try again.",
} as const;

const entries = new Map<string, Entry>();
const owners = new Map<string, number>();
const errors = new Map<string, ErrorLine>();
const errorTimers = new Map<string, ReturnType<typeof setTimeout>>();
let prompt: Prompt | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getEntry = (slug: string): Entry => entries.get(slug) ?? EMPTY_ENTRY;
export const getPrompt = (): Prompt | null => prompt;
export const getErrorLine = (slug: string): ErrorLine | null => errors.get(slug) ?? null;

function patchFlag(slug: string, target: Target, patch: Partial<Flag>): void {
  const e = entries.get(slug);
  if (!e) return;
  if (target === "star") entries.set(slug, { ...e, star: { ...e.star, ...patch } });
  else entries.set(slug, { ...e, reactions: { ...e.reactions, [target]: { ...e.reactions[target], ...patch } } });
  emit();
}

const flagOf = (e: Entry, target: Target): Flag => (target === "star" ? e.star : e.reactions[target]);

function setError(slug: string, text: string): void {
  errors.set(slug, { slug, text });
  const old = errorTimers.get(slug);
  if (old) clearTimeout(old);
  errorTimers.set(
    slug,
    setTimeout(() => clearError(slug), 8_000),
  );
  announce(text);
  emit();
}

function clearError(slug: string): void {
  const t = errorTimers.get(slug);
  if (t) clearTimeout(t);
  errorTimers.delete(slug);
  if (errors.delete(slug)) emit();
}

function failureText(target: Target, code: CommunityFailure): string {
  if (code === "rate_limited") return MESSAGES.limited;
  return target === "star" ? MESSAGES.star : MESSAGES.react;
}

// ---- which workflows this page shows, and this browser's own state for them (`mine`) ------------------------------

const pendingMine = new Set<string>();
let mineScheduled = false;
const releaseTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * A control for `slug` mounted (after hydration, when the real `clientId` is known). The first one for a slug resets its
 * state and asks the server which of the stars/reactions are this browser's; later ones share it. Returns the release.
 */
export function acquire(slug: string): () => void {
  const pendingRelease = releaseTimers.get(slug);
  if (pendingRelease) {
    clearTimeout(pendingRelease);
    releaseTimers.delete(slug);
  }
  const n = owners.get(slug) ?? 0;
  owners.set(slug, n + 1);
  if (!entries.has(slug)) {
    entries.set(slug, { ...EMPTY_ENTRY });
    pendingMine.add(slug);
    if (!mineScheduled) {
      mineScheduled = true;
      setTimeout(flushMine, 0);
    }
  }
  return () => {
    const left = (owners.get(slug) ?? 1) - 1;
    if (left > 0) {
      owners.set(slug, left);
      return;
    }
    owners.set(slug, 0);
    // Deferred, so React StrictMode's mount -> cleanup -> mount keeps the state instead of refetching.
    releaseTimers.set(
      slug,
      setTimeout(() => {
        releaseTimers.delete(slug);
        if ((owners.get(slug) ?? 0) === 0) {
          owners.delete(slug);
          entries.delete(slug);
          emit();
        }
      }, 50),
    );
  };
}

async function flushMine(): Promise<void> {
  mineScheduled = false;
  const slugs = [...pendingMine];
  pendingMine.clear();
  const { clientId } = getState().community;
  for (let i = 0; i < slugs.length; i += COMMUNITY_MAX_SLUGS) {
    const chunk = slugs.slice(i, i + COMMUNITY_MAX_SLUGS);
    void postCommunity({ op: "mine", clientId, slugs: chunk }).then((res) => {
      for (const slug of chunk) {
        const current = entries.get(slug);
        if (!current) continue;
        const mine = res.ok ? res.data.mine.find((m) => m.slug === slug) : undefined;
        // On failure the toggles enable as unpressed: a mistaken "on" is a no-op because writes are desired-state.
        const reactions = Object.fromEntries(
          REACTION_KEYS.map((k) => [k, flagFrom(mine?.reactions.includes(k) ?? false)]),
        ) as Record<ReactionKey, Flag>;
        entries.set(slug, { loaded: true, star: flagFrom(mine?.starred ?? false), reactions });
      }
      emit();
    });
  }
}

// ---- writes -------------------------------------------------------------------------------------------------------

let identityPersisted = false;

/**
 * A first-time browser holds its clientId only in memory until something writes the progress doc. The first write that
 * uses the id stores it, so a reload is the same person (their stars come back as "mine"). Idempotent; a copy makes
 * the store treat it as a change worth writing.
 */
function persistIdentity(): void {
  if (identityPersisted) return;
  identityPersisted = true;
  updateProgress((s) => ({ ...s }));
}

/** Press a toggle. `trigger` is the button, so focus can return to it when the name prompt closes. */
export function press(slug: string, target: Target, trigger: HTMLElement | null): void {
  const e = entries.get(slug);
  if (!e?.loaded) return;
  const flag = flagOf(e, target);
  const next = !flag.desired;
  persistIdentity();
  patchFlag(slug, target, { desired: next });
  if (next) maybePrompt(slug, target === "star" ? "star" : "react", trigger);
  if (!flag.inflight) void send(slug, target);
}

async function send(slug: string, target: Target): Promise<void> {
  patchFlag(slug, target, { inflight: true });
  for (;;) {
    const e = entries.get(slug);
    if (!e) return; // the page was left; nothing on screen to update
    const flag = flagOf(e, target);
    const value = flag.desired;
    const { clientId, displayName } = getState().community;
    const res = await postCommunity(
      target === "star"
        ? { op: "star", clientId, slug, on: value }
        : { op: "react", clientId, slug, reaction: target, on: value, displayName },
    );
    const after = entries.get(slug);
    if (!after) return;
    if (!res.ok) {
      // Roll back to the last acknowledged state and say so (CM-5).
      patchFlag(slug, target, { desired: flagOf(after, target).confirmed, inflight: false });
      setError(slug, failureText(target, res.code));
      return;
    }
    patchFlag(slug, target, { confirmed: value });
    clearError(slug);
    if (flagOf(entries.get(slug) ?? after, target).desired === value) {
      patchFlag(slug, target, { inflight: false });
      return;
    }
  }
}

// ---- the optional name (CM-4) -------------------------------------------------------------------------------------

function maybePrompt(slug: string, kind: Prompt["kind"], trigger: HTMLElement | null): void {
  if (getState().community.namePrompted || prompt) return;
  prompt = { slug, kind, trigger };
  emit();
  announce("Add your name? Optional.");
}

/** Close the prompt and give focus back to the control that opened it. */
export function closePrompt(): void {
  const trigger = prompt?.trigger;
  prompt = null;
  emit();
  if (trigger?.isConnected) trigger.focus();
}

function storeName(name: string | null): void {
  updateProgress((s) => ({ ...s, community: { ...s.community, displayName: name, namePrompted: true } }));
}

/** "Skip": remembered, so the prompt never returns in this browser. */
export function skipName(): void {
  storeName(null);
  closePrompt();
}

export type SaveNameResult = { ok: true; name: string | null } | { ok: false };

/**
 * Save (or clear) the display name. It is stored locally first, then written to every reaction of this browser.
 * An empty first-time name behaves as Skip (no request). On a failed request the local name stays, so the next Save retries.
 */
export async function saveName(raw: string): Promise<SaveNameResult> {
  const n = normalizeDisplayName(raw);
  if (!n.ok) return { ok: false };
  const previous = getState().community.displayName;
  storeName(n.value);
  if (n.value === null && previous === null) return { ok: true, name: null };
  const res = await postCommunity({ op: "name", clientId: getState().community.clientId, displayName: n.value });
  return res.ok ? { ok: true, name: n.value } : { ok: false };
}

/** Test seam: forget everything. */
export function __resetCommunityStoreForTests(): void {
  entries.clear();
  owners.clear();
  errors.clear();
  pendingMine.clear();
  prompt = null;
  mineScheduled = false;
  identityPersisted = false;
  for (const t of errorTimers.values()) clearTimeout(t);
  errorTimers.clear();
  for (const t of releaseTimers.values()) clearTimeout(t);
  releaseTimers.clear();
}
