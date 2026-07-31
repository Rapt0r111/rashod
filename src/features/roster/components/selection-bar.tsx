import { memo } from "react";
import { CheckSquareIcon, XIcon } from "@phosphor-icons/react";
import type { LocationOption } from "../types";
import { cx } from "../utils";
import { toneClasses } from "./person-views";

export const SelectionBar = memo(function SelectionBar({
  count,
  totalVisible,
  locations,
  pending,
  onSelectAll,
  onClear,
  onMove,
  onOpenMore,
}: {
  count: number;
  totalVisible: number;
  locations: LocationOption[];
  pending?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onMove: (to: string) => void;
  onOpenMore: () => void;
}) {
  if (count <= 0) return null;
  const quick = locations.filter((location) => location.isQuick);

  return (
    <div
      className="fixed bottom-5 left-1/2 z-60 flex w-[min(720px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-line-strong bg-[color-mix(in_oklch,var(--bg-base)_92%,transparent)] p-2.5 shadow-(--shadow) backdrop-blur-xl"
      role="toolbar"
      aria-label="Массовый перевод"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <strong className="px-1 font-mono text-sm text-cyan">{count}</strong>
        <span className="text-xs font-semibold text-text-secondary">выбрано</span>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line bg-white/5 px-2.5 text-xs font-bold text-text-primary disabled:opacity-50"
          onClick={onSelectAll}
          disabled={pending || count >= totalVisible}
        >
          <CheckSquareIcon size={15} weight="bold" />
          Все на экране
        </button>
        <button
          type="button"
          className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-xl border border-line bg-white/5 px-2.5 text-xs font-bold text-text-secondary"
          onClick={onClear}
          disabled={pending}
          aria-label="Снять выбор"
        >
          <XIcon size={15} weight="bold" />
          Снять
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5">
        {quick.map((location) => {
          const tone = toneClasses(location.colorToken);
          return (
            <button
              key={location.id}
              type="button"
              className={cx(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 font-bold text-text-primary transition duration-200 active:translate-y-px disabled:cursor-wait disabled:opacity-55",
                tone.border,
                tone.soft,
              )}
              disabled={pending}
              onClick={() => onMove(location.key)}
              title={location.label}
              aria-label={`Перевести выбранных в ${location.label}`}
            >
              <span className={cx("font-mono text-sm", tone.text)}>{location.quickCode}</span>
              <span className="text-xs">{location.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-accent-line bg-accent-soft px-3 text-xs font-bold text-text-primary disabled:opacity-55"
          disabled={pending}
          onClick={onOpenMore}
        >
          Другое место…
        </button>
      </div>
    </div>
  );
});
