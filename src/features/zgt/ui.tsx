"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import { SelectField } from "@/components/select-field";
import {
  CheckIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  WarningCircleIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { Loader } from "@/components/loader";
import { cx } from "@/features/roster/utils";
import { searchZgtPeople } from "./api";
import type { PersonPickerItem } from "./types";

const focusRingClass =
  "focus-visible:border-cyan focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--cyan)_22%,transparent)]";

export const zgtFieldClass = cx(
  "min-h-[42px] w-full rounded-[10px] border border-line bg-bg-raised px-3 py-2 text-sm text-text-primary outline-none transition-[border-color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
  focusRingClass,
);

export const zgtBtnClass = cx(
  "inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-3.5 text-sm font-semibold transition-[background-color,border-color,opacity,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-45",
  focusRingClass,
);

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
  href?: string;
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
        const interactive = Boolean(onSelect) || Boolean(item.href);
        const className = cx(
          "rounded-2xl border bg-bg-panel/80 px-3 py-2.5 text-left no-underline transition-[border-color,background-color,box-shadow] duration-150",
          item.active
            ? "border-[color-mix(in_oklch,var(--cyan)_40%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_10%,transparent)]"
            : "border-line",
          interactive &&
            cx(
              "cursor-pointer hover:border-line-strong hover:bg-bg-raised/70",
              focusRingClass,
            ),
        );
        const body = (
          <>
            <div className="text-xs font-semibold text-text-muted">{item.label}</div>
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
          </>
        );
        if (onSelect) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={className}
              aria-pressed={item.active}
              aria-label={`${item.label}: ${item.value}`}
            >
              {body}
            </button>
          );
        }
        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              className={className}
              aria-label={`${item.label}: ${item.value}`}
            >
              {body}
            </Link>
          );
        }
        return (
          <div
            key={item.id}
            className={className}
            aria-label={`${item.label}: ${item.value}`}
          >
            {body}
          </div>
        );
      })}
    </section>
  );
}

export function ZgtToolbar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
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
      {actions ? (
        <div className="ms-auto flex flex-wrap items-end gap-2">{actions}</div>
      ) : null}
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
            className={cx(
              "absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-text-muted transition hover:bg-white/8 hover:text-text-primary",
              focusRingClass,
            )}
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") return [];
    const props = child.props as { value?: string | number; children?: ReactNode };
    return [{ value: String(props.value ?? ""), label: String(props.children ?? "") }];
  });
  return (
    <div className={cx("grid min-w-0 gap-1", className)}>
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      <SelectField
        ariaLabel={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        variant="admin"
      />
    </div>
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
          <>
            <span className="ml-1 text-red" aria-hidden>
              *
            </span>
            <span className="sr-only"> (обязательно)</span>
          </>
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

export function ZgtFormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cx(
        "col-span-full grid gap-3 rounded-[10px] border border-line bg-bg-raised/40 p-3 sm:grid-cols-2",
        className,
      )}
    >
      <legend className="px-1 text-sm font-bold text-text-primary">{title}</legend>
      {children}
    </fieldset>
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
  tone = "error",
  onDismiss,
}: {
  message: string;
  tone?: "error" | "success" | "warning";
  onDismiss?: () => void;
}) {
  const palette =
    tone === "success"
      ? "border-[color-mix(in_oklch,var(--green)_35%,transparent)] bg-[color-mix(in_oklch,var(--green)_12%,transparent)] text-green"
      : tone === "warning"
        ? "border-[color-mix(in_oklch,var(--amber)_35%,transparent)] bg-[color-mix(in_oklch,var(--amber)_12%,transparent)] text-amber"
        : "border-[color-mix(in_oklch,var(--red)_35%,transparent)] bg-[color-mix(in_oklch,var(--red)_12%,transparent)] text-red";
  return (
    <div
      className={cx(
        "mb-3 flex items-start gap-3 rounded-2xl border px-3 py-2.5 text-sm",
        palette,
      )}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <p className="m-0 min-w-0 flex-1 leading-5">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          className={cx(
            "grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] border border-transparent transition hover:bg-white/8",
            focusRingClass,
          )}
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
          "transition-opacity duration-150",
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

export function ZgtListLayout({
  table,
  cards,
}: {
  table: ReactNode;
  cards: ReactNode;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">{table}</div>
      <div className="md:hidden">{cards}</div>
    </>
  );
}

export function ZgtMobileCard({
  title,
  subtitle,
  fields,
  actions,
  leading,
  onOpen,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  fields?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
  leading?: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <article className="border-t border-line/80 px-3 py-3 first:border-t-0">
      <div className="flex items-start gap-2">
        {leading}
        <div className="min-w-0 flex-1">
          {onOpen ? (
            <button
              type="button"
              className={cx(
                "cursor-pointer rounded-[6px] text-left font-semibold text-text-primary transition-colors hover:text-cyan",
                focusRingClass,
              )}
              onClick={onOpen}
            >
              {title}
            </button>
          ) : (
            <div className="font-semibold text-text-primary">{title}</div>
          )}
          {subtitle ? <div className="mt-0.5 text-xs text-text-muted">{subtitle}</div> : null}
          {fields && fields.length > 0 ? (
            <dl className="mt-2 grid grid-cols-2 gap-2">
              {fields.map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-[11px] font-semibold text-text-muted">{field.label}</dt>
                  <dd className="m-0 mt-0.5 text-sm text-text-secondary">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-col gap-1">{actions}</div> : null}
      </div>
    </article>
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

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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
            className={cx(
              "grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/[0.06] hover:text-text-primary",
              focusRingClass,
            )}
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

export function ZgtConfirmDialog({
  open,
  title,
  text,
  confirmLabel = "Удалить",
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const panelRef = useDialogFocus(onClose, { open });
  const titleId = useId();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-bg-overlay p-4"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        ref={panelRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-line bg-bg-panel p-5 shadow-(--shadow)"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[color-mix(in_oklch,var(--red)_35%,transparent)] bg-[color-mix(in_oklch,var(--red)_12%,transparent)] text-red">
            <WarningCircleIcon size={20} weight="fill" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="m-0 text-lg font-bold">
              {title}
            </h2>
            <p className="m-0 mt-1 text-sm leading-5 text-text-secondary">{text}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={zgtBtnSecondaryClass}
            onClick={onClose}
            disabled={pending}
          >
            Отмена
          </button>
          <button
            type="button"
            className={zgtBtnDangerClass}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Удаление…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function personLabel(person: PersonPickerItem) {
  return `${person.rank} ${person.name}`.trim();
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
  const [picked, setPicked] = useState<PersonPickerItem | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const inputId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      setSearching(false);
      setOpen(false);
      return;
    }
    if (picked && query.trim() === personLabel(picked)) {
      setOptions([]);
      setSearching(false);
      setOpen(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(() => {
      void searchZgtPeople(query)
        .then((result) => {
          setOptions(result);
          setActiveIndex(0);
          setOpen(true);
        })
        .catch(() => {
          setOptions([]);
          setOpen(true);
        })
        .finally(() => setSearching(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [picked, query]);

  useEffect(() => {
    if (!selectedId) setPicked(null);
  }, [selectedId]);

  function clearSelection() {
    onQueryChange("");
    onClear?.();
    setPicked(null);
    setOptions([]);
    setOpen(false);
  }

  function choose(person: PersonPickerItem) {
    setPicked(person);
    onSelect(person);
    onQueryChange(personLabel(person));
    setOptions([]);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (!open || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(activeIndex + 1, options.length - 1);
      setActiveIndex(next);
      optionRefs.current[next]?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(activeIndex - 1, 0);
      setActiveIndex(next);
      optionRefs.current[next]?.focus();
      return;
    }
    if (event.key === "Enter" && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex]);
    }
  }

  const showEmpty = open && !searching && query.trim() && options.length === 0 && !picked;
  const selectedName = picked ? personLabel(picked) : query.trim();

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
            id={inputId}
            className={cx(zgtFieldClass, "pl-9 pr-9")}
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              onQueryChange(next);
              if (!next.trim()) {
                onClear?.();
                setPicked(null);
                setOptions([]);
                setOpen(false);
                return;
              }
              if (picked && next.trim() !== personLabel(picked)) {
                onClear?.();
                setPicked(null);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined
            }
          />
          {query ? (
            <button
              type="button"
              className={cx(
                "absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-text-muted hover:bg-white/8 hover:text-text-primary",
                focusRingClass,
              )}
              onClick={clearSelection}
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
      {showEmpty ? (
        <p className="m-0 text-xs text-text-muted">Никого не нашли. Проверьте фамилию или звание.</p>
      ) : null}
      {options.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="m-0 max-h-44 list-none overflow-auto rounded-[10px] border border-line bg-bg-base p-1"
        >
          {options.map((person, index) => (
            <li
              key={person.id}
              role="option"
              id={`${listId}-${person.id}`}
              aria-selected={selectedId === person.id || activeIndex === index}
            >
              <button
                type="button"
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                className={cx(
                  "flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/[0.06]",
                  focusRingClass,
                  activeIndex === index && "bg-white/[0.06]",
                )}
                onClick={() => choose(person)}
              >
                <span className="font-semibold text-text-primary">{personLabel(person)}</span>
                <span className="text-xs text-text-muted">
                  {person.platoonLabel ?? "—"} · {person.locationLabel ?? person.location}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selectedId && selectedName ? (
        <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-text-secondary">
          <CheckIcon size={12} className="shrink-0 text-green" aria-hidden />
          <span className="min-w-0 truncate">
            Выбран: <span className="font-semibold text-text-primary">{selectedName}</span>
            {picked?.locationLabel ? ` · ${picked.locationLabel}` : ""}
          </span>
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
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      className={cx(
        "inline-flex min-h-[42px] min-w-[42px] cursor-pointer items-center justify-center rounded-[10px] border border-transparent transition-[border-color,background-color] duration-150 hover:bg-white/[0.05]",
        focusRingClass,
        className,
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cx(
          "grid h-5 w-5 place-items-center rounded-[6px] border transition-[border-color,background-color] duration-150",
          checked || indeterminate
            ? "border-accent-line bg-accent-soft text-text-primary"
            : "border-line-strong bg-white/[0.04] text-transparent",
        )}
        aria-hidden
      >
        {indeterminate ? (
          <MinusIcon size={12} weight="bold" />
        ) : checked ? (
          <CheckIcon size={12} weight="bold" />
        ) : null}
      </span>
    </button>
  );
}

export function ZgtToggleChip({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cx(
        "inline-flex min-h-[42px] max-w-full cursor-pointer items-center gap-2 rounded-[13px] border px-3 text-left text-sm font-semibold transition-[border-color,background-color,color] duration-150",
        focusRingClass,
        checked
          ? "border-accent-line bg-accent-soft text-text-primary"
          : "border-line bg-bg-raised text-text-secondary hover:border-line-strong hover:text-text-primary",
        className,
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cx(
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border",
          checked
            ? "border-accent-line bg-[color-mix(in_oklch,var(--accent)_22%,transparent)]"
            : "border-line-strong bg-white/[0.04]",
        )}
        aria-hidden
      >
        {checked ? <CheckIcon size={12} weight="bold" /> : null}
      </span>
      {label}
    </button>
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
        focusRingClass,
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
