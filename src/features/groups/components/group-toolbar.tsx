"use client";

import {
  CalendarBlankIcon,
  ClipboardTextIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import type { DutyGroupSnapshot } from "../types";
import { colorTokenClass, formatDateLabel } from "../utils";
import { iconMap, priorityModeLabels } from "./shared-meta";

export function GroupToolbar({
  item,
  selectedDate,
  onRotate,
  onAssign,
  onToggle,
  disabled,
}: {
  item: DutyGroupSnapshot;
  selectedDate: string;
  onRotate: () => void;
  onAssign: () => void;
  onToggle: () => void;
  disabled: boolean;
}) {
  const Icon =
    iconMap[item.template.icon as keyof typeof iconMap] ?? ClipboardTextIcon;
  return (
    <div
      className={`grid min-w-0 items-center gap-3 rounded-[16px] border border-(--tone-line) bg-bg-panel p-3 min-[1800px]:grid-cols-[minmax(0,1fr)_auto] ${colorTokenClass(item.template.colorToken)}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9.5 w-9.5 flex-none place-items-center rounded-[14px] bg-(--tone-soft) text-(--tone)">
          <Icon size={24} weight="duotone" />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tracking-[-0.02em]" title={item.group.name}>
            {item.group.name}
          </h2>
          <p className="m-0 mt-0.75 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
            {item.template.name} · {item.rule.peoplePerDay} чел. в день ·{" "}
            {priorityModeLabels[item.rule.priorityMode]}
          </p>
        </div>
      </div>
      <div className="grid min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-3.25 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          onClick={onToggle}
          disabled={disabled}
        >
          {item.group.enabled ? "Отключить группу" : "Включить группу"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-3.25 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          onClick={onRotate}
          disabled={disabled}
        >
          <CalendarBlankIcon size={17} /> Запустить ротацию{" "}
          {formatDateLabel(selectedDate)}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          onClick={onAssign}
          disabled={disabled}
        >
          <UserPlusIcon size={17} /> Назначить
        </button>
      </div>
    </div>
  );
}

