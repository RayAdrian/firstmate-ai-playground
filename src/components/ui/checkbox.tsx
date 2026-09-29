"use client";

import { useId } from "react";
import { cn } from "./cn";

/**
 * Native checkbox (DESIGN.md §4.6): the whole row is the 44px hit target.
 * Controlled: pass `checked` and `onChange`.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  id,
  disabled,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label
      htmlFor={inputId}
      className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2.5", disabled && "cursor-not-allowed", className)}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed dark:accent-link"
      />
      <span className="text-base text-fg">{label}</span>
    </label>
  );
}
