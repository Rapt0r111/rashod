import type { SearchSortOption } from "@/components/search-sort-control";
import { memo, type ReactNode } from "react";
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import type { LocationGroupConflict } from "../../types";
import { ApiError } from "../../api";

export function locationGroupConflicts(error: unknown): LocationGroupConflict[] {
  if (!(error instanceof ApiError) || error.status !== 409 || typeof error.payload !== "object" || error.payload === null) return [];
  const conflicts = (error.payload as { conflicts?: unknown }).conflicts;
  if (!Array.isArray(conflicts)) return [];
  return conflicts.filter((item): item is LocationGroupConflict => {
    if (typeof item !== "object" || item === null) return false;
    const value = item as Record<string, unknown>;
    return typeof value.locationKey === "string" && typeof value.groupId === "string" && typeof value.groupLabel === "string";
  });
}
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="mb-3.5 grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">{children}</div>;
}
export function AdminList({ children }: { children: ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}
export const AdminRow = memo(function AdminRow({
  title,
  meta,
  onEdit,
  onDelete,
  disabled = false,
}: {
  title: string;
  meta: string;
  onEdit: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_36px_36px] items-center gap-2 rounded-[13px] border border-line bg-white/[0.035] px-2.5 py-2">
      <div className="grid min-w-0 gap-0.5">
        <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{title}</strong>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">{meta}</span>
      </div>
      <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border border-line bg-transparent text-text-secondary transition hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan" type="button" onClick={onEdit} aria-label="Изменить" disabled={disabled}>
        <PencilSimpleIcon size={16} />
      </button>
      {onDelete && (
        <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border border-line bg-transparent text-text-secondary transition hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan" type="button" onClick={onDelete} aria-label="Удалить" disabled={disabled}>
          <TrashIcon size={16} />
        </button>
      )}
    </div>
  );
});

export const referenceSortOptions: SearchSortOption[] = [
  { key: "alpha", label: "А–Я" },
];

export const fieldClass = "min-h-10.5 min-w-0 w-full rounded-xl border border-line bg-bg-raised px-3 text-text-primary outline-none transition placeholder:text-text-muted hover:border-line-strong focus:border-cyan focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--cyan)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-55";
export const submitClass = "inline-flex min-h-10.5 items-center justify-center gap-1.5 rounded-xl border border-accent-line bg-accent-soft px-3.5 font-bold text-text-primary disabled:cursor-not-allowed disabled:opacity-55";

