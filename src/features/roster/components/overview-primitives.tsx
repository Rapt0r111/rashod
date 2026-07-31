import type { ReactNode } from "react";
import { memo } from "react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  ListMagnifyingGlassIcon,
} from "@phosphor-icons/react";
import type { Person, Platoon } from "../types";
import { cx } from "../utils";
import { overviewLocationMetrics } from "../roster-metrics";
import { toneClasses } from "./person-views";

export type OverviewLocationMetricLike = ReturnType<
  typeof overviewLocationMetrics
>[number];

export function visibleLocationMetrics(
  items: OverviewLocationMetricLike[],
  selection: { mode: "all" | "selected"; keys: string[] },
  showEmpty: boolean,
) {
  const selected =
    selection.mode === "all"
      ? items
      : items.filter((item) => selection.keys.includes(item.key));
  return showEmpty ? selected : selected.filter((item) => item.count > 0);
}

export function selectedOverviewItems<T extends { platoon: Platoon }>(
  items: T[],
  selection: { mode: "all" | "selected"; keys: string[] },
) {
  return selection.mode === "all"
    ? items
    : items.filter((item) => selection.keys.includes(item.platoon.id));
}

export function overviewDateTime(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sortOverviewItemsByCount(items: OverviewLocationMetricLike[]) {
  return [...items].sort(
    (left, right) =>
      right.count - left.count ||
      left.sortOrder - right.sortOrder ||
      left.label.localeCompare(right.label, "ru"),
  );
}

export function sortOverviewPlatoonStatsByCount<
  T extends { platoon: Platoon; roster: Person[] },
>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      right.roster.length - left.roster.length ||
      left.platoon.sortOrder - right.platoon.sortOrder ||
      left.platoon.label.localeCompare(right.platoon.label, "ru"),
  );
}

export function OverviewEmpty({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "m-0 rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-xs text-text-muted",
        className,
      )}
    >
      {text}
    </p>
  );
}

export const SectionHeader = memo(function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 max-[560px]:flex-col">
      <div className="min-w-0">
        <h1 className="m-0 text-[26px] leading-[1.1]">{title}</h1>
        <p className="mt-1.75 wrap-break-word text-text-muted">
          {subtitle}
        </p>
      </div>
      {action}
    </div>
  );
});

export function OverviewBlock({
  order,
  density,
  layout,
  children,
}: {
  order: number;
  density: "standard" | "compact";
  layout: "full" | "half";
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "grid w-full min-w-0 items-start",
        density === "compact" ? "gap-2" : "gap-3",
        layout === "full"
          ? "col-span-full"
          : "col-span-1 max-[1100px]:col-span-full",
      )}
      style={{ order }}
    >
      {children}
    </div>
  );
}

export const StatCard = memo(function StatCard({
  label,
  value,
  tone = "accent",
  sub,
  trend,
}: {
  label: string;
  value: number;
  tone?: string;
  sub?: string;
  trend?: "up" | "down";
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel p-4.5">
      <strong
        className={cx(
          "block font-mono text-[30px] font-extrabold leading-none tabular-nums",
          toneClasses(tone).text,
        )}
      >
        {value}
      </strong>
      <span className="mt-2 block wrap-break-word text-text-secondary">
        {label}
      </span>
      {sub && (
        <span className="mt-4.5 flex min-w-0 items-center gap-1.5 wrap-break-word text-xs text-text-muted">
          {trend === "up" && (
            <ArrowRightIcon
              size={12}
              weight="bold"
              className="text-green"
            />
          )}
          {trend === "down" && (
            <ArrowDownIcon
              size={12}
              weight="bold"
              className="text-red"
            />
          )}
          {sub}
        </span>
      )}
    </div>
  );
});

export const FilterPills = memo(function FilterPills({
  label,
  items,
  active,
  activeKeys,
  onPick,
}: {
  label: string;
  items: Array<{ key: string | null; label: string; count: number }>;
  active: string | null;
  activeKeys?: string[];
  onPick: (value: string | null) => void;
}) {
  const selectedKeys = activeKeys ?? (active ? [active] : []);
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-text-muted"
      aria-label={label}
    >
      <span className="mr-1 text-xs font-semibold">{label}</span>
      {selectedKeys.length > 1 && (
        <span className="rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-xs text-text-primary">
          Выбрано: {selectedKeys.length}
        </span>
      )}
      {items.map((item) => {
        const selected =
          item.key === null
            ? selectedKeys.length === 0
            : selectedKeys.includes(item.key);
        return (
          <button
            type="button"
            key={item.key ?? "all"}
            aria-pressed={selected}
            data-selected={selected ? "true" : undefined}
            className={cx(
              "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 text-xs transition-[background,border-color,box-shadow,color,filter] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-panel",
              selected
                ? "border-accent bg-accent font-extrabold text-[oklch(12%_0.04_286)] hover:brightness-110"
                : "border-line bg-white/4 text-text-secondary hover:border-line-strong hover:bg-white/8 hover:text-text-primary",
            )}
            onClick={() => onPick(item.key)}
          >
            {selected && (
              <CheckIcon size={14} weight="bold" aria-hidden="true" />
            )}
            {item.label}
            <b
              className={
                selected
                  ? "ml-1 text-current opacity-70"
                  : "ml-1 text-text-muted"
              }
            >
              {item.count}
            </b>
          </button>
        );
      })}
    </div>
  );
});

export const EmptyState = memo(function EmptyState() {
  return (
    <div className="grid min-h-55 place-items-center gap-2 rounded-[18px] border border-dashed border-line-strong text-text-muted">
      <ListMagnifyingGlassIcon size={36} weight="regular" />
      <strong className="text-text-primary">Никого не найдено</strong>
      <span>Измените поиск или фильтр.</span>
    </div>
  );
});
