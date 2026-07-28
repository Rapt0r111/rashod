import type { ReactNode } from "react";

type DisclosureContentProps = {
  children: ReactNode;
  className?: string;
  open: boolean;
};

export function DisclosureContent({ children, className = "", open }: DisclosureContentProps) {
  return (
    <div className={`grid transform-gpu transition-[grid-template-rows,opacity,transform] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] translate-y-0 opacity-100" : "grid-rows-[0fr] -translate-y-1.5 opacity-0"} ${className}`} data-open={open} aria-hidden={!open} inert={!open || undefined}>
      <div className={`min-h-0 ${open ? "overflow-visible" : "overflow-hidden"}`}>{children}</div>
    </div>
  );
}
