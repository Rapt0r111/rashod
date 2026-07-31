"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { cx } from "../../utils";

export function StyledCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        "flex min-h-10.5 w-full min-w-0 cursor-pointer items-center justify-start gap-2.5 rounded-xl border border-line bg-bg-raised px-3 text-left font-semibold text-text-secondary transition hover:border-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
        checked && "border-accent-line bg-accent-soft text-text-primary",
      )}
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cx(
          "grid h-4.75 w-4.75 shrink-0 place-items-center rounded-[7px] border border-line-strong bg-white/5.5 text-[oklch(12%_0.04_286)]",
          checked &&
            "border-accent bg-[linear-gradient(135deg,var(--accent),var(--cyan))]",
        )}
        aria-hidden="true"
      >
        {checked && <CheckIcon size={14} weight="bold" />}
      </span>
      <span>{label}</span>
    </button>
  );
}
