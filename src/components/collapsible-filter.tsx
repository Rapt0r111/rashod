"use client";

import { CaretDownIcon, FunnelIcon, XIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { DisclosureContent } from "./disclosure-content";

type CollapsibleFilterProps = { children: ReactNode; activeCount?: number; className?: string; defaultOpen?: boolean; label?: string; onClear?: () => void };

export function CollapsibleFilter({ children, activeCount = 0, className = "", defaultOpen = false, label = "Фильтры", onClear }: CollapsibleFilterProps) {
  const [open, setOpen] = useState(defaultOpen);
  const summary = activeCount > 0 ? `${activeCount} выбрано` : "Все значения";
  return <section className={`grid overflow-visible rounded-[14px] border border-line bg-white/2.5 ${open ? "relative z-30" : ""} ${className}`} aria-label={label}>
    <button className="group flex min-h-11 w-full items-center justify-between gap-3 border-0 bg-transparent px-3 text-left text-text-primary transition-colors duration-200 hover:bg-white/5.5 focus-visible:bg-white/5.5" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className="flex min-w-0 items-center gap-2"><FunnelIcon className="shrink-0 text-cyan" size={17} weight="bold" /><strong className="text-[13px]">{label}</strong><small className="truncate text-xs text-text-muted">{summary}</small></span>
      <CaretDownIcon className={`shrink-0 text-text-muted transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} size={18} aria-hidden="true" />
    </button>
    <DisclosureContent open={open}>
      <div className={`flex items-start gap-2.5 border-t px-3 py-0 transition-[border-color,padding] duration-200 ease-out motion-reduce:transition-none max-[520px]:flex-col max-[520px]:items-stretch ${open ? "border-line py-2.5" : "border-transparent"}`}><div className="grid min-w-0 flex-1 gap-2.5">{children}</div>{activeCount > 0 && onClear && <button type="button" className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-line bg-transparent px-2.5 text-xs font-bold text-text-secondary transition-colors duration-200 hover:border-accent-line hover:text-text-primary focus-visible:border-accent-line max-[520px]:w-full" onClick={onClear}><XIcon size={15} weight="bold" /> Сбросить</button>}</div>
    </DisclosureContent>
  </section>;
}
