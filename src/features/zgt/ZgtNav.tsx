"use client";

import Link from "next/link";
import {
  DesktopTowerIcon,
  DeviceMobileIcon,
  SquaresFourIcon,
  UsbIcon,
} from "@phosphor-icons/react";
import { cx } from "@/features/roster/utils";

const LINKS = [
  {
    href: "/zgt",
    label: "Обзор",
    match: "exact" as const,
    icon: SquaresFourIcon,
  },
  {
    href: "/zgt/equipment",
    label: "Техника",
    match: "prefix" as const,
    icon: DesktopTowerIcon,
  },
  {
    href: "/zgt/phones",
    label: "Телефоны",
    match: "prefix" as const,
    icon: DeviceMobileIcon,
  },
  {
    href: "/zgt/storage-items",
    label: "Носители",
    match: "prefix" as const,
    icon: UsbIcon,
  },
];

export function ZgtNav({ activePath }: { activePath: string }) {
  return (
    <nav
      className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-bg-panel/70 p-1.5"
      aria-label="Разделы ЗГТ"
    >
      {LINKS.map((link) => {
        const active =
          link.match === "exact"
            ? activePath === link.href
            : activePath === link.href || activePath.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cx(
              "inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-[13px] border px-3 text-sm font-semibold no-underline transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:border-cyan focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--cyan)_22%,transparent)]",
              active
                ? "border-[color-mix(in_oklch,var(--cyan)_34%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_14%,transparent)] text-cyan"
                : "border-transparent text-text-secondary hover:border-line hover:bg-white/[0.04] hover:text-text-primary",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={16} weight={active ? "fill" : "regular"} aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
