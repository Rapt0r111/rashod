"use client";

import { useEffect, useId, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";
import { useDialogFocus } from "@/components/use-dialog-focus";

export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useDialogFocus(onClose);
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-90 flex justify-end bg-bg-overlay backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        ref={panelRef}
        className="grid min-h-dvh w-[min(460px,100vw)] min-w-0 content-start gap-3.5 overflow-y-auto border-l border-line bg-[oklch(15%_0.038_286)] p-4 shadow-[-20px_0_60px_rgb(0_0_0/0.32)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tracking-[-0.02em]" title={title}>
            {title}
          </h2>
          <button
            type="button"
            className="inline-flex h-8.5 min-h-8.5 w-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.04)] p-0 text-text-secondary transition-[background,border-color,transform] duration-200 hover:bg-[oklch(100%_0_0/0.08)] hover:text-text-primary cursor-pointer active:translate-y-px"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <XIcon size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

