"use client";

import type { ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { DisclosureContent } from "@/components/disclosure-content";
import { cx } from "../../roster/utils";

export function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden border-t border-line">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-0 bg-transparent px-0 py-3 text-left text-xs font-extrabold text-text-secondary transition-colors duration-150 hover:text-text-primary"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{title}</span>
        <CaretDownIcon
          size={16}
          className={cx(
            "transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <DisclosureContent open={open}>
        <div className="grid gap-3 pb-3">{children}</div>
      </DisclosureContent>
    </div>
  );
}

