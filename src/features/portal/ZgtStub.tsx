"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  DesktopTowerIcon,
  DeviceMobileIcon,
  UsbIcon,
  type Icon,
} from "@phosphor-icons/react";
import { PortalPageHeader } from "./PortalChrome";
import type { Permission } from "@/features/auth/permissions";
import { hasRashodAccess } from "./modules";
import type { EquipmentStats } from "@/features/zgt/types";
import type { PhoneStats } from "@/features/zgt/phones-types";
import type { StorageItemStats } from "@/features/zgt/storage-items-types";
import { ZgtNav } from "@/features/zgt/ZgtNav";
import { ZgtStatStrip, zgtBtnSecondaryClass } from "@/features/zgt/ui";
import { cx } from "@/features/roster/utils";

export function ZgtHome({
  permissions,
  equipmentStats,
  phoneStats,
  storageStats,
}: {
  permissions: readonly Permission[];
  equipmentStats: EquipmentStats;
  phoneStats: PhoneStats;
  storageStats: StorageItemStats;
}) {
  const attention =
    equipmentStats.repair +
    equipmentStats.broken +
    storageStats.broken +
    storageStats.lost;

  return (
    <div className="grid w-full min-w-0 gap-0">
      <PortalPageHeader
        title="ЗГТ"
        subtitle="Техника, телефоны и носители. Владельцы — из реестра Расхода."
      />
      <ZgtNav activePath="/zgt" />

      <ZgtStatStrip
        className="!grid-cols-2 sm:!grid-cols-4 lg:!grid-cols-4"
        items={[
          {
            id: "equipment",
            label: "Техника",
            value: equipmentStats.total,
            tone: equipmentStats.broken > 0 ? "red" : undefined,
            href: "/zgt/equipment",
          },
          {
            id: "phones-in",
            label: "Телефоны сданы",
            value: phoneStats.checkedIn,
            tone: "green",
            href: "/zgt/phones?status=checked_in",
          },
          {
            id: "phones-out",
            label: "Телефоны на руках",
            value: phoneStats.checkedOut,
            tone: phoneStats.checkedOut > 0 ? "amber" : undefined,
            href: "/zgt/phones?status=checked_out",
          },
          {
            id: "attention",
            label: "Требуют внимания",
            value: attention,
            tone: attention > 0 ? "red" : "green",
            href:
              storageStats.broken + storageStats.lost > equipmentStats.repair + equipmentStats.broken
                ? "/zgt/storage-items?status=broken"
                : "/zgt/equipment?status=repair",
          },
        ]}
      />

      <div className="mt-3 grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
        <ModuleCard
          href="/zgt/equipment"
          icon={DesktopTowerIcon}
          title="Техника"
          description="ПЭВМ, ноутбуки, выдачи, перемещения и история."
          primaryAction="Открыть список"
          stats={[
            { label: "В работе", value: equipmentStats.inUse, tone: "green" },
            { label: "Склад", value: equipmentStats.storage },
            {
              label: "Ремонт / брак",
              value: equipmentStats.repair + equipmentStats.broken,
              tone:
                equipmentStats.repair + equipmentStats.broken > 0 ? "red" : undefined,
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
        <h2 className="m-0 text-base font-bold">Как работать</h2>
        <ul className="mt-3 mb-0 grid list-none gap-2 p-0 text-sm leading-6 text-text-secondary">
          <li>Отметьте строки в списке — появится панель выдачи, сдачи и перемещения.</li>
          <li>Владельца и адресата выбирайте поиском по Расходу, не вводите ФИО вручную.</li>
          <li>Для телефонов при сдаче укажите ячейку — так проще найти аппарат вечером.</li>
          <li>Цифры сверху фильтруют список. Повторное нажатие снимает фильтр.</li>
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
    </div>
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
      prefetch
      className="group flex min-h-48 flex-col rounded-2xl border border-line bg-bg-panel/80 p-4 no-underline text-inherit transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-bg-raised/70 focus-visible:border-cyan focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--cyan)_22%,transparent)] sm:p-5"
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

      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-16">
            <dt className="text-xs font-semibold text-text-muted">{stat.label}</dt>
            <dd
              className={cx(
                "m-0 mt-0.5 font-mono text-lg font-bold tabular-nums",
                stat.tone === "green" && "text-green",
                stat.tone === "amber" && "text-amber",
                stat.tone === "red" && "text-red",
                stat.tone === "blue" && "text-blue",
              )}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

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
