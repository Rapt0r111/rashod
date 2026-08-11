"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  DesktopTowerIcon,
  DeviceMobileIcon,
  UsbIcon,
  type Icon,
} from "@phosphor-icons/react";
import { PortalChrome } from "./PortalChrome";
import type { PortalModuleId } from "./modules";
import type { Permission } from "@/features/auth/permissions";
import { hasRashodAccess, hasZgtAccess } from "./modules";
import type { EquipmentStats } from "@/features/zgt/types";
import type { PhoneStats } from "@/features/zgt/phones-types";
import type { StorageItemStats } from "@/features/zgt/storage-items-types";
import { ZgtNav } from "@/features/zgt/ZgtNav";
import { ZgtStatStrip, zgtBtnSecondaryClass } from "@/features/zgt/ui";
import { cx } from "@/features/roster/utils";

export function ZgtHome({
  displayName,
  permissions,
  equipmentStats,
  phoneStats,
  storageStats,
}: {
  displayName: string;
  permissions: readonly Permission[];
  equipmentStats: EquipmentStats;
  phoneStats: PhoneStats;
  storageStats: StorageItemStats;
}) {
  const availableModuleIds: PortalModuleId[] = [];
  if (hasRashodAccess(permissions)) availableModuleIds.push("rashod");
  if (hasZgtAccess(permissions)) availableModuleIds.push("zgt");

  const attention =
    equipmentStats.repair +
    equipmentStats.broken +
    storageStats.broken +
    storageStats.lost;

  return (
    <PortalChrome
      activeModule="zgt"
      displayName={displayName}
      availableModuleIds={availableModuleIds}
      title="ЗГТ"
      subtitle="Техника, телефоны и носители. Владельцы — из реестра Расхода."
    >
      <ZgtNav activePath="/zgt" />

      <ZgtStatStrip
        className="lg:grid-cols-4"
        items={[
          {
            id: "equipment",
            label: "Техника",
            value: equipmentStats.total,
            tone: equipmentStats.broken > 0 ? "red" : undefined,
          },
          {
            id: "phones-in",
            label: "Телефоны сданы",
            value: phoneStats.checkedIn,
            tone: "green",
          },
          {
            id: "phones-out",
            label: "Телефоны на руках",
            value: phoneStats.checkedOut,
            tone: phoneStats.checkedOut > 0 ? "amber" : undefined,
          },
          {
            id: "attention",
            label: "Требуют внимания",
            value: attention,
            tone: attention > 0 ? "red" : "green",
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <ModuleCard
          href="/zgt/equipment"
          icon={DesktopTowerIcon}
          title="Техника"
          description="ПЭВМ, ноутбуки, выдачи, перемещения и история."
          primaryAction="Открыть список"
          stats={[
            { label: "В работе", value: equipmentStats.inUse, tone: "blue" },
            { label: "Склад", value: equipmentStats.storage },
            {
              label: "Ремонт / брак",
              value: equipmentStats.repair + equipmentStats.broken,
              tone:
                equipmentStats.repair + equipmentStats.broken > 0
                  ? "red"
                  : undefined,
            },
          ]}
        />
        <ModuleCard
          href="/zgt/phones"
          icon={DeviceMobileIcon}
          title="Телефоны"
          description="Сдача и выдача личных телефонов, ячейки хранения."
          primaryAction="Сдача / выдача"
          stats={[
            { label: "Всего", value: phoneStats.total },
            { label: "Сдано", value: phoneStats.checkedIn, tone: "green" },
            {
              label: "На руках",
              value: phoneStats.checkedOut,
              tone: "amber",
            },
          ]}
        />
        <ModuleCard
          href="/zgt/storage-items"
          icon={UsbIcon}
          title="Носители"
          description="Флеш-накопители и электронные пропуска."
          primaryAction="Учёт носителей"
          stats={[
            { label: "Выдано", value: storageStats.inUse, tone: "blue" },
            { label: "Склад", value: storageStats.stock },
            {
              label: "Проблемы",
              value: storageStats.broken + storageStats.lost,
              tone:
                storageStats.broken + storageStats.lost > 0 ? "red" : undefined,
            },
          ]}
        />
      </div>

      <section className="mt-4 rounded-2xl border border-line bg-bg-panel/80 p-4 sm:p-5">
        <h2 className="m-0 text-base font-bold">Как устроен учёт</h2>
        <ul className="mt-3 mb-0 grid gap-2 pl-5 text-sm leading-6 text-text-secondary">
          <li>
            Один вход портала, права{" "}
            <code className="rounded-md bg-white/6 px-1.5 py-0.5 font-mono text-[12px]">
              zgt:read
            </code>{" "}
            /{" "}
            <code className="rounded-md bg-white/6 px-1.5 py-0.5 font-mono text-[12px]">
              zgt:write
            </code>
          </li>
          <li>
            Владельцы и адресаты выдач — люди из реестра Расхода (
            <code className="rounded-md bg-white/6 px-1.5 py-0.5 font-mono text-[12px]">
              people
            </code>
            )
          </li>
          <li>
            Статус человека общий:{" "}
            <code className="rounded-md bg-white/6 px-1.5 py-0.5 font-mono text-[12px]">
              people.location
            </code>
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/portal" className={cx(zgtBtnSecondaryClass, "no-underline")}>
            К модулям
          </Link>
          {hasRashodAccess(permissions) ? (
            <Link href="/" className={cx(zgtBtnSecondaryClass, "no-underline")}>
              Расход
            </Link>
          ) : null}
        </div>
      </section>
    </PortalChrome>
  );
}

function ModuleCard({
  href,
  icon: Icon,
  title,
  description,
  primaryAction,
  stats,
}: {
  href: string;
  icon: Icon;
  title: string;
  description: string;
  primaryAction: string;
  stats: Array<{ label: string; value: number; tone?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-52 flex-col rounded-2xl border border-line bg-bg-panel/80 p-4 no-underline text-inherit transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-bg-raised/70 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] border border-line bg-bg-raised text-cyan">
          <Icon size={22} weight="duotone" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-bold tracking-[-0.02em]">{title}</h2>
          <p className="m-0 mt-1 text-sm leading-5 text-text-secondary">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[10px] border border-line bg-bg-raised/70 px-2 py-2"
          >
            <div className="text-xs font-semibold text-text-muted">{stat.label}</div>
            <div
              className={cx(
                "mt-0.5 font-mono text-lg font-bold tabular-nums",
                stat.tone === "green" && "text-green",
                stat.tone === "amber" && "text-amber",
                stat.tone === "red" && "text-red",
                stat.tone === "blue" && "text-blue",
              )}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-cyan">
        {primaryAction}
        <ArrowRightIcon
          size={14}
          weight="bold"
          className="transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}

/** @deprecated use ZgtHome */
export const ZgtStub = ZgtHome;
