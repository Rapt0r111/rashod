"use client";

import { ClipboardTextIcon } from "@phosphor-icons/react";

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-45 place-items-center gap-2 rounded-[18px] border border-dashed border-line-strong p-5.5 text-center text-text-secondary">
      <ClipboardTextIcon size={28} weight="duotone" />
      <strong className="text-text-primary">{title}</strong>
      <span className="max-w-[36ch] wrap-anywhere text-[13px] leading-normal text-text-muted">
        {text}
      </span>
    </div>
  );
}
