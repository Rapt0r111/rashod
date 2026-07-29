import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { cx } from "../features/roster/utils";

type Option = { label: string; value: string };

type SelectFieldProps = {
  ariaLabel: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  variant?: "admin" | "groups";
  disabled?: boolean;
  className?: string;
};

export function SelectField({
  ariaLabel,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  variant = "groups",
  disabled = false,
  className = "",
}: SelectFieldProps) {
  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const searchId = `${fieldId}-search`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value);

  const visibleOptions = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    if (searchPlaceholder) {
      searchRef.current?.focus();
    } else {
      optionRefs.current[activeIndex]?.focus();
    }
  }, [activeIndex, open, searchPlaceholder]);

  const triggerRadius = variant === "admin" ? "rounded-xl" : "rounded-xl";
  const isDisabled = disabled || options.length === 0;

  function closeList({ restoreFocus = true } = {}) {
    setOpen(false);
    setQuery("");
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function choose(option: Option) {
    onChange(option.value);
    closeList();
  }

  function focusOption(index: number) {
    if (visibleOptions.length === 0) return;
    const next = Math.max(0, Math.min(index, visibleOptions.length - 1));
    setActiveIndex(next);
    optionRefs.current[next]?.focus();
  }

  function handleListKey(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeList();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(activeIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(activeIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusOption(visibleOptions.length - 1);
    }
  }

  return (
    <div
      className={cx("relative min-w-0", className, open && "z-40")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery("");
        }
      }}
      onKeyDown={handleListKey}
    >
      <button
        ref={triggerRef}
        type="button"
        className={cx("flex min-h-10.5 w-full min-w-0 items-center justify-between gap-2.5 border border-line bg-bg-raised px-3 text-left font-semibold text-text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.055)] transition-[border-color,background,box-shadow] duration-200 hover:border-[oklch(77%_0.14_191/0.52)] focus-visible:border-[oklch(77%_0.14_191/0.52)] disabled:cursor-not-allowed disabled:opacity-55", triggerRadius, open && "border-[oklch(77%_0.14_191/0.52)] bg-[oklch(77%_0.14_191/0.09)]")}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={isDisabled}
        onClick={() => setOpen((current) => {
          if (current) {
            setQuery("");
            return false;
          }
          const selectedIndex = options.findIndex((option) => option.value === value);
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
          return true;
        })}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            const selectedIndex = options.findIndex((option) => option.value === value);
            setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
            setOpen(true);
          }
        }}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder ?? ariaLabel}</span>
        <CaretDownIcon className={cx("shrink-0 transition-transform duration-200", open && "rotate-180")} size={16} weight="bold" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-45 grid w-max min-w-full max-w-[calc(100vw-24px)] gap-1 rounded-[14px] border border-line-strong bg-[oklch(14%_0.04_286/0.98)] p-1.5 shadow-[0_18px_52px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.06)]">
          {searchPlaceholder && (
            <label className="grid gap-1">
              <span className="sr-only">{searchPlaceholder}</span>
              <input
                ref={searchRef}
                id={searchId}
                className="min-h-9.5 w-full rounded-[10px] border border-line bg-bg-raised px-2.5 text-text-primary outline-none transition-[border-color,box-shadow] duration-200 focus:border-[oklch(77%_0.14_191/0.58)] focus:shadow-[0_0_0_3px_oklch(77%_0.14_191/0.1)]"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </label>
          )}
          <div id={listboxId} className="grid max-h-62 gap-1 overflow-auto pr-0.5" role="listbox" aria-label={ariaLabel} aria-describedby={searchPlaceholder ? searchId : undefined}>
            {visibleOptions.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-line p-2.5 text-center text-xs font-bold text-text-muted" role="status">Ничего не найдено</div>
            ) : visibleOptions.map((option, index) => {
              const active = option.value === value;
              return (
                <button
                  ref={(node) => { optionRefs.current[index] = node; }}
                  key={option.value}
                  type="button"
                  className={cx("grid min-h-9 w-full grid-cols-[minmax(0,1fr)_18px] items-center gap-2 rounded-[10px] border border-transparent bg-transparent px-3 text-left font-semibold text-text-secondary transition-colors duration-200 hover:border-line hover:bg-white/5.5 hover:text-text-primary focus-visible:border-line", active && "border-accent-line bg-accent-soft text-text-primary")}
                  role="option"
                  aria-selected={active}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onFocus={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span className="min-w-0 truncate whitespace-nowrap">{option.label}</span>
                  {active && <CheckIcon size={15} weight="bold" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
