"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { cx } from "../../roster/utils";

export function StyledCheckbox({
  checked,
  label,
  title,
  compact = false,
  onChange,
}: {
  checked: boolean;
  label: string;
  title?: string;
  compact?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex min-h-10.5 max-w-full min-w-0 items-center justify-start gap-2.25 rounded-xl border border-line bg-[oklch(100%_0_0/0.04)] px-3 text-left text-[13px] font-bold text-text-secondary transition-[border-color,background,color,transform] duration-200 hover:border-[oklch(77%_0.14_191/0.46)] hover:bg-[oklch(77%_0.14_191/0.1)] hover:text-text-primary focus-visible:border-[oklch(77%_0.14_191/0.46)] focus-visible:outline-none cursor-pointer active:translate-y-px",
        checked &&
          "border-accent-line bg-accent-soft text-text-primary",
        compact && "min-h-8.5 rounded-full px-2.5 text-xs",
      )}
      role="checkbox"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span
        className="grid h-4.75 w-4.75 flex-none place-items-center rounded-[7px] border border-line-strong bg-[oklch(100%_0_0/0.055)] text-[oklch(81%_0.829_286)]"
        aria-hidden="true"
      >
        {checked && <CheckIcon size={compact ? 12 : 14} weight="bold" />}
      </span>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

