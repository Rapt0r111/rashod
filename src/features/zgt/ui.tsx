"use client";

import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  MagnifyingGlassIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { Loader } from "@/components/loader";
import { cx } from "@/features/roster/utils";
import { searchZgtPeople } from "./api";
import type { PersonPickerItem } from "./types";

export const zgtFieldClass =
  "min-h-[42px] w-full rounded-[10px] border border-line bg-bg-raised px-3 py-2 text-sm text-text-primary outline-none transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--cyan)_22%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const zgtBtnClass =
  "inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-3.5 text-sm font-semibold transition-[background-color,border-color,opacity,color] duration-150 disabled:cursor-not-allowed disabled:opacity-45";

export const zgtBtnPrimaryClass = cx(
  zgtBtnClass,
  "border-accent-line bg-accent-soft text-text-primary hover:bg-[color-mix(in_oklch,var(--accent)_22%,transparent)]",
);

export const zgtBtnSecondaryClass = cx(
  zgtBtnClass,
  "border-line bg-bg-raised text-text-primary hover:border-line-strong hover:bg-white/[0.06]",
);

export const zgtBtnGhostClass = cx(
  zgtBtnClass,
  "border-transparent bg-transparent text-text-secondary hover:border-line hover:bg-white/[0.04] hover:text-text-primary",
);

export const zgtBtnDangerClass = cx(
  zgtBtnClass,
  "border-[color-mix(in_oklch,var(--red)_35%,transparent)] bg-[color-mix(in_oklch,var(--red)_10%,transparent)] text-red hover:bg-[color-mix(in_oklch,var(--red)_16%,transparent)]",
);

export function toneClass(tone: string) {
  if (tone === "green") {
    return "text-green border-[color-mix(in_oklch,var(--green)_35%,transparent)] bg-[color-mix(in_oklch,var(--green)_12%,transparent)]";
  }
  if (tone === "blue") {
    return "text-blue border-[color-mix(in_oklch,var(--blue)_35%,transparent)] bg-[color-mix(in_oklch,var(--blue)_12%,transparent)]";
  }
  if (tone === "amber") {
    return "text-amber border-[color-mix(in_oklch,var(--amber)_35%,transparent)] bg-[color-mix(in_oklch,var(--amber)_12%,transparent)]";
  }
  if (tone === "red") {
    return "text-red border-[color-mix(in_oklch,var(--red)_35%,transparent)] bg-[color-mix(in_oklch,var(--red)_12%,transparent)]";
  }
  if (tone === "cyan") {
    return "text-cyan border-[color-mix(in_oklch,var(--cyan)_34%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_12%,transparent)]";
  }
  return "text-text-secondary border-line bg-white/[0.04]";
}

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center truncate rounded-[13px] border px-2 py-0.5 text-xs font-semibold",
        toneClass(tone),
      )}
    >
      {label}
    </span>
  );
}

export type StatChip = {
  id: string;
  label: string;
  value: number;
  tone?: string;
  active?: boolean;
};

/** Dense KPI strip; chips can act as filters when onSelect is set. */
export function ZgtStatStrip({
  items,
  onSelect,
  className,
}: {
  items: StatChip[];
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
      aria-label="Сводка"
    >
      {items.map((item) => {
        const interactive = Boolean(onSelect);
        const Comp = interactive ? "button" : "div";
        return (
          <Comp
            key={item.id}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onSelect?.(item.id) : undefined}
            className={cx(
              "rounded-2xl border bg-bg-panel/80 px-3 py-2.5 text-left transition-[border-color,background-color] duration-150",
              item.active
                ? "border-[color-mix(in_oklch,var(--cyan)_40%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_10%,transparent)]"
                : "border-line",
              interactive &&
                "cursor-pointer hover:border-line-strong hover:bg-bg-raised/70",
            )}
            aria-pressed={interactive ? item.active : undefined}
          >
            <div className="text-xs font-semibold text-text-muted">
              {item.label}
            </div>
            <div
              className={cx(
                "mt-1 font-mono text-2xl font-bold tabular-nums leading-none",
                item.tone === "green" && "text-green",
                item.tone === "amber" && "text-amber",
                item.tone === "red" && "text-red",
                item.tone === "blue" && "text-blue",
                !item.tone && "text-text-primary",
              )}
            >
              {item.value}
            </div>
          </Comp>
        );
      })}
    </section>
  );
}

export function ZgtToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-bg-panel/75 p-3",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ZgtSearchField({
  value,
  onChange,
  placeholder,
  label = "Поиск",
  className,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const id = useId();
  return (
    <label
      className={cx("grid min-w-48 flex-1 gap-1 text-xs font-semibold text-text-muted", className)}
      htmlFor={id}
    >
      {label}
      <span className="relative">
        <MagnifyingGlassIcon
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          size={16}
          aria-hidden
        />
        <input
          id={id}
          className={cx(zgtFieldClass, "pl-9 pr-9")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          {...rest}
        />
        {value ? (
          <button
            type="button"
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-text-muted transition hover:bg-white/8 hover:text-text-primary"
            onClick={() => onChange("")}
            aria-label="Очистить поиск"
          >
            <XIcon size={14} weight="bold" />
          </button>
        ) : null}
      </span>
    </label>
  );
}

export function ZgtSelectField({
  label,
  value,
  onChange,
  children,
  className,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "className">) {
  const id = useId();
  return (
    <label className={cx("grid gap-1 text-xs font-semibold text-text-muted", className)} htmlFor={id}>
      {label}
      <select
        id={id}
        className={zgtFieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function ZgtField({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("grid gap-1 text-xs font-semibold text-text-muted", className)}>
      <span>
        {label}
        {required ? (
          <span className="ml-1 text-red" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint && !error ? (
        <span className="text-xs font-normal text-text-muted">{hint}</span>
      ) : null}
      {error ? (
        <span className="text-xs font-semibold text-red" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function ZgtInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(zgtFieldClass, props.className)} {...props} />;
}

export function ZgtTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(zgtFieldClass, "min-h-20 py-2.5", props.className)}
      {...props}
    />
  );
}

export function ZgtAlert({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="mb-3 flex items-start gap-3 rounded-2xl border border-[color-mix(in_oklch,var(--red)_35%,transparent)] bg-[color-mix(in_oklch,var(--red)_12%,transparent)] px-3 py-2.5 text-sm text-red"
      role="alert"
      aria-live="assertive"
    >
      <p className="m-0 min-w-0 flex-1 leading-5">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] border border-transparent text-red transition hover:bg-white/8"
          onClick={onDismiss}
          aria-label="Закрыть сообщение"
        >
          <XIcon size={14} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}

export function ZgtEmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: Icon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-2 px-4 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-bg-raised text-text-muted">
        <Icon size={26} weight="duotone" aria-hidden />
      </div>
      <strong className="text-base text-text-primary">{title}</strong>
      <p className="m-0 max-w-[42ch] text-sm leading-5 text-text-muted">{text}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ZgtBatchBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className="sticky top-0 z-10 mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-accent-line bg-[color-mix(in_oklch,var(--accent)_12%,var(--bg-panel))] p-3 shadow-(--shadow)"
      aria-label="Массовые действия"
    >
      <div className="mr-1 min-w-28">
        <div className="text-xs font-semibold text-text-muted">Выбрано</div>
        <div className="font-mono text-xl font-bold tabular-nums">{count}</div>
      </div>
      {children}
      <button type="button" className={zgtBtnGhostClass} onClick={onClear}>
        Сбросить
      </button>
    </section>
  );
}

export function ZgtDataPanel({
  title,
  total,
  loading,
  children,
  footer,
}: {
  title: string;
  total: number;
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-bg-panel/80">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="text-sm font-bold">
          {title}
          <span className="ml-2 font-mono text-text-muted tabular-nums">{total}</span>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-2 text-xs text-text-muted">
            <Loader />
            Обновление…
          </span>
        ) : null}
      </div>
      <div
        className={cx(
          "overflow-x-auto transition-opacity duration-150",
          loading && "opacity-60",
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export function ZgtPagination({
  page,
  pageCount,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <span className="text-text-muted">
        Стр.{" "}
        <span className="font-mono font-semibold text-text-secondary tabular-nums">
          {page}
        </span>{" "}
        /{" "}
        <span className="font-mono font-semibold text-text-secondary tabular-nums">
          {Math.max(pageCount, 1)}
        </span>
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className={zgtBtnSecondaryClass}
          disabled={page <= 1 || loading}
          onClick={onPrev}
        >
          Назад
        </button>
        <button
          type="button"
          className={zgtBtnSecondaryClass}
          disabled={page >= pageCount || loading}
          onClick={onNext}
        >
          Далее
        </button>
      </div>
    </>
  );
}

export function ZgtDialog({
  open,
  title,
  description,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useDialogFocus(onClose, { open });
  const titleId = useId();
  const descId = useId();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-bg-overlay p-0 sm:place-items-center sm:p-4"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        ref={panelRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cx(
          "max-h-[min(92dvh,860px)] w-full overflow-auto border border-line bg-bg-panel p-5 shadow-(--shadow) sm:rounded-2xl",
          wide ? "max-w-2xl" : "max-w-xl",
          "rounded-t-2xl",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="m-0 text-xl font-bold tracking-[-0.02em]">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="m-0 mt-1 text-sm text-text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/[0.06] hover:text-text-primary"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <XIcon size={16} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ZgtPersonSearch({
  query,
  onQueryChange,
  selectedId,
  onSelect,
  onClear,
  label = "Человек из Расхода",
  required,
  placeholder = "Фамилия, звание, № приказа…",
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (person: PersonPickerItem) => void;
  onClear?: () => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [options, setOptions] = useState<PersonPickerItem[]>([]);
  const [searching, setSearching] = useState(false);
  const listId = useId();

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(() => {
      void searchZgtPeople(query)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <div className={cx("grid gap-1", className)}>
      <ZgtField label={label} required={required}>
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            size={16}
            aria-hidden
          />
          <input
            className={cx(zgtFieldClass, "pl-9 pr-9")}
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              if (!event.target.value.trim()) onClear?.();
            }}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-text-muted hover:bg-white/8 hover:text-text-primary"
              onClick={() => {
                onQueryChange("");
                onClear?.();
                setOptions([]);
              }}
              aria-label="Очистить человека"
            >
              <XIcon size={14} weight="bold" />
            </button>
          ) : null}
        </div>
      </ZgtField>
      {searching ? (
        <span className="text-xs text-text-muted">Ищем в реестре…</span>
      ) : null}
      {options.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="m-0 max-h-44 list-none overflow-auto rounded-[10px] border border-line bg-bg-base p-1"
        >
          {options.map((person) => (
            <li key={person.id} role="option" aria-selected={selectedId === person.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/[0.06]"
                onClick={() => {
                  onSelect(person);
                  setOptions([]);
                }}
              >
                <span className="font-semibold text-text-primary">
                  {person.rank} {person.name}
                </span>
                <span className="text-xs text-text-muted">
                  {person.platoonLabel ?? "—"} · {person.locationLabel ?? person.location}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selectedId && !options.length ? (
        <span className="text-xs font-mono text-text-muted">
          Выбран: {selectedId.slice(0, 8)}…
        </span>
      ) : null}
    </div>
  );
}

export function ZgtCheckbox({
  checked,
  onChange,
  label,
  indeterminate,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  indeterminate?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cx(
        "inline-flex min-h-[42px] min-w-[42px] cursor-pointer items-center justify-center gap-2",
        className,
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--cyan)]"
        checked={checked}
        ref={(node) => {
          if (node) node.indeterminate = Boolean(indeterminate);
        }}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
    </label>
  );
}

export function ZgtIconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex min-h-[42px] min-w-[42px] cursor-pointer items-center justify-center rounded-[10px] border border-line bg-bg-raised text-text-secondary transition hover:border-line-strong hover:bg-white/[0.06] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      aria-label={label}
      title={label}
      {...props}
    />
  );
}

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-bg-raised/80 px-3 py-2">
      <dt className="text-xs font-semibold text-text-muted">{label}</dt>
      <dd className="m-0 mt-1 text-sm font-semibold text-text-primary">{value}</dd>
    </div>
  );
}
