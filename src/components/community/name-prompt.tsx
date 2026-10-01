"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button-styles";
import { announce } from "@/components/ui/live-region";
import { DISPLAY_NAME_MAX } from "@/lib/contracts";
import { useCommunityIdentity, useNamePrompt } from "@/lib/community/hooks";
import { closePrompt, saveName, skipName } from "@/lib/community/store";

const FIELD =
  "h-11 w-full min-w-0 rounded-xl border border-border bg-canvas px-3 text-base text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2";

/** Plain-text name, truncated and direction-isolated so a long or right-to-left name cannot push the line around. */
export function NameText({ name }: { name: string }) {
  return (
    <bdi title={name} className="inline-block max-w-[18ch] truncate align-bottom font-medium text-fg">
      {name}
    </bdi>
  );
}

/**
 * "Add your name? Optional" (CM-4, DESIGN 4.13.5). Shown once, inline (not a modal), after the first star or reaction in a
 * browser that has not been asked. It never blocks the action; Save and Skip are both remembered.
 */
export function NamePrompt({ slug, className = "" }: { slug: string; className?: string }) {
  const prompt = useNamePrompt();
  const { community } = useCommunityIdentity();
  const titleId = useId();
  const helpId = useId();
  const inputId = useId();
  const [value, setValue] = useState(community.displayName ?? "");
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!prompt || prompt.slug !== slug) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveName(value);
    setSaving(false);
    if (!res.ok) {
      setFailed(true); // stay open, focus stays in the input; the local name is stored so the next Save retries
      return;
    }
    if (res.name !== null) announce("Name saved");
    closePrompt();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      skipName();
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className={`relative z-10 mt-3 rounded-xl bg-accent-subtle p-4 ${className}`}
    >
      <p className="text-sm text-fg">{prompt.kind === "star" ? "Thanks for the star." : "Thanks for sharing that."}</p>
      <p id={titleId} className="mt-1 text-base font-bold text-fg-strong">
        Add your name? Optional
      </p>
      <form onSubmit={onSubmit} className="mt-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-fg">
              Your name
            </label>
            <input
              id={inputId}
              type="text"
              maxLength={DISPLAY_NAME_MAX}
              autoComplete="nickname"
              aria-describedby={helpId}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setFailed(false);
              }}
              className={FIELD}
            />
          </div>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={skipName}>
            Skip
          </Button>
        </div>
        <p id={helpId} className="mt-2 text-sm text-fg-muted">
          Shown next to your reactions. Saved in this browser.
        </p>
        {failed ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            Couldn&apos;t save your name. Try again.
          </p>
        ) : null}
      </form>
    </section>
  );
}

/** "Reacting as Rafael · Edit name" / "Reacting anonymously · Add name" (CM-4, DESIGN 4.13.6). Workflow page only. */
export function NameControl() {
  const { hydrated, community } = useCommunityIdentity();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const helpId = useId();
  const name = community.displayName;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function finish() {
    setEditing(false);
    setFailed(false);
    // The trigger button is re-mounted by the swap, so focus it on the next frame.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveName(draft);
    setSaving(false);
    if (!res.ok) {
      setFailed(true);
      return;
    }
    announce(res.name === null ? "You're reacting anonymously" : "Name saved");
    finish();
  }

  return (
    <div className="mt-2 min-h-6 text-sm text-fg-muted">
      {!hydrated ? null : editing ? (
        <form
          onSubmit={onSubmit}
          onKeyDown={(e) => {
            if (e.key === "Escape") finish();
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
              <label htmlFor={inputId} className="font-medium text-fg">
                Your name
              </label>
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                maxLength={DISPLAY_NAME_MAX}
                autoComplete="nickname"
                aria-describedby={helpId}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setFailed(false);
                }}
                className={FIELD}
              />
            </div>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={finish}>
              Cancel
            </Button>
          </div>
          <p id={helpId} className="mt-2">
            Saved in this browser. Clear it to react anonymously.
          </p>
          {failed ? (
            <p role="alert" className="mt-1 text-danger">
              Couldn&apos;t save your name. Try again.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2">
          <span>
            {name ? (
              <>
                Reacting as <NameText name={name} />
              </>
            ) : (
              "Reacting anonymously"
            )}
          </span>
          <span aria-hidden="true">·</span>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              setDraft(name ?? "");
              setEditing(true);
            }}
            className={`${buttonClasses("link")} touch:min-h-11 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2`}
          >
            {name ? "Edit name" : "Add name"}
          </button>
        </p>
      )}
    </div>
  );
}
