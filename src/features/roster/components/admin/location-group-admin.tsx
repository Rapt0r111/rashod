"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { SearchSortControl, type SearchSortOption } from "@/components/search-sort-control";
import type { LocationGroup, Snapshot } from "../../types";
import { fetchJson, getApiErrorMessage } from "../../api";
import { cx, locationLabel } from "../../utils";
import { SelectField } from "@/components/select-field";
import { filterListItems, sortListItems, type ListSortState } from "@/components/list-utils";
import { AdminList, AdminRow, FormGrid, locationGroupConflicts, fieldClass, submitClass, referenceSortOptions } from "./admin-shared";
import { StyledCheckbox } from "./styled-checkbox";

export function LocationGroupAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState<LocationGroup | null>(null);
  const [form, setForm] = useState({
    label: "",
    colorToken: "cyan",
    enabled: true,
    sortOrder: 0,
    locationKeys: [] as string[],
  });
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);

  const candidates = useMemo(() => {
    const known = new Map(snapshot.locations.map((location) => [location.key, {
      key: location.key,
      label: location.label,
      count: snapshot.people.filter((person) => person.location === location.key).length,
    }]));
    for (const person of snapshot.people) {
      if (!known.has(person.location)) {
        known.set(person.location, {
          key: person.location,
          label: locationLabel(person.location, snapshot.locations),
          count: snapshot.people.filter((item) => item.location === person.location).length,
        });
      }
    }
    return Array.from(known.values()).sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [snapshot.locations, snapshot.people]);

  const visibleGroups = useMemo(() => sortListItems(
    filterListItems(snapshot.locationGroups, query, (item) => `${item.label} ${item.locationKeys.join(" ")}`),
    sort,
    { label: (item) => item.label, defaultCompare: (a, b) => a.sortOrder - b.sortOrder },
  ), [query, snapshot.locationGroups, sort]);

  const visibleCandidates = useMemo(() => {
    const needle = memberQuery.trim().toLocaleLowerCase("ru-RU");
    return needle
      ? candidates.filter((item) => `${item.label} ${item.key}`.toLocaleLowerCase("ru-RU").includes(needle))
      : candidates;
  }, [candidates, memberQuery]);

  const groupByLocation = useMemo(() => {
    const result = new Map<string, LocationGroup[]>();
    for (const group of snapshot.locationGroups) {
      for (const key of group.locationKeys) {
        const groups = result.get(key) ?? [];
        groups.push(group);
        result.set(key, groups);
      }
    }
    return result;
  }, [snapshot.locationGroups]);

  function reset() {
    setEditing(null);
    setForm({ label: "", colorToken: "cyan", enabled: true, sortOrder: 0, locationKeys: [] });
    setMemberQuery("");
    setErrorMessage("");
  }

  async function persist(allowTransfer: boolean) {
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/location-groups", {
          method: "POST",
          body: JSON.stringify({ ...form, id: editing?.id, allowTransfer }),
        }),
      );
      reset();
    } catch (error) {
      const conflicts = locationGroupConflicts(error);
      if (!allowTransfer && conflicts.length) {
        const labels = conflicts
          .map(
            (item) =>
              `${locationLabel(item.locationKey, snapshot.locations)} → ${item.groupLabel}`,
          )
          .join("\n");
        if (
          window.confirm(
            `Места уже входят в другие объединения. Перенести их в «${form.label.trim()}»?\n\n${labels}`,
          )
        ) {
          // Nested retry without re-checking outer `pending` guard.
          await persist(true);
          return;
        }
      }
      setErrorMessage(
        conflicts.length
          ? "Перенос отменён. Состав группы не изменён."
          : getApiErrorMessage(error, "Сохранение не выполнено"),
      );
    }
  }

  async function save(allowTransfer = false) {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      await persist(allowTransfer);
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (pending) return;
    if (!window.confirm("Удалить объединение мест? Люди и исходные места не изменятся.")) {
      return;
    }
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/location-groups", {
          method: "DELETE",
          body: JSON.stringify({ id }),
        }),
      );
      if (editing?.id === id) reset();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Удаление не выполнено"));
    } finally {
      setPending(false);
    }
  }

  function edit(item: LocationGroup) {
    setEditing(item);
    setForm({
      label: item.label,
      colorToken: item.colorToken,
      enabled: item.enabled,
      sortOrder: item.sortOrder,
      locationKeys: [...item.locationKeys],
    });
    setMemberQuery("");
    setErrorMessage("");
  }

  function toggleMember(key: string) {
    setForm((current) => ({
      ...current,
      locationKeys: current.locationKeys.includes(key)
        ? current.locationKeys.filter((item) => item !== key)
        : [...current.locationKeys, key],
    }));
  }

  return (
    <div className="overflow-auto px-4 pb-4.5 pt-3">
      <p className="mb-3 text-xs leading-5 text-text-muted">
        Группы меняют только отображение обзора. Исходные места людей сохраняются.
      </p>
      <FormGrid>
        <input className={fieldClass}
          aria-label="Название объединения"
          placeholder="Например: Рота и наряд"
          value={form.label}
          onChange={(event) => setForm({ ...form, label: event.target.value })}
        />
        <SelectField
          ariaLabel="Цвет объединения"
          value={form.colorToken}
          options={["neutral", "green", "blue", "amber", "cyan", "red", "violet"].map((tone) => ({ label: tone, value: tone }))}
          onChange={(value) => setForm({ ...form, colorToken: value })}
          variant="admin"
        />
        <label className="grid gap-1.5">
          <span className="text-xs font-extrabold text-text-secondary">Порядок</span>
          <input className={fieldClass} type="number" min={0} step={1} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })} />
        </label>
        <StyledCheckbox checked={form.enabled} label="Показывать в обзоре" onChange={(enabled) => setForm({ ...form, enabled })} />
        <div className="col-span-full grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-text-secondary">Места в объединении: {form.locationKeys.length}</span>
            <input className={`${fieldClass} max-w-55`} aria-label="Поиск мест для объединения" placeholder="Найти место" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
            {visibleCandidates.map((item) => {
              const checked = form.locationKeys.includes(item.key);
              const currentGroups = (groupByLocation.get(item.key) ?? []).filter((group) => group.id !== editing?.id);
              const conflict = currentGroups[0];
              return (
                <button
                  type="button"
                  key={item.key}
                  role="checkbox"
                  aria-checked={checked}
                  className={cx("flex min-h-10.5 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 text-left transition-colors duration-200 cursor-pointer", checked ? "border-accent-line bg-accent-soft text-text-primary" : "border-line bg-bg-raised text-text-secondary hover:border-line-strong")}
                  onClick={() => toggleMember(item.key)}
              disabled={pending}
                >
                  <span className="min-w-0 truncate font-semibold">{item.label}</span>
                  <span className={cx("shrink-0 text-right text-xs", conflict ? "text-amber" : "font-mono text-text-muted")}>{conflict ? `Сейчас: ${conflict.label}` : item.count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {errorMessage && <p className="col-span-full m-0 text-xs text-red">{errorMessage}</p>}
        <button className={submitClass} type="button" onClick={() => void save()} disabled={pending || !form.label.trim()}>
          <PlusIcon size={16} />
          {editing ? "Сохранить" : "Добавить"}
        </button>
        {editing && <button className={fieldClass} type="button" onClick={reset} disabled={pending}>Сбросить форму</button>}
      </FormGrid>
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        options={referenceSortOptions}
        showSort={false}
        placeholder="Найти объединение"
        ariaLabel="Поиск объединений"
      />
      <AdminList>
        {visibleGroups.map((item) => (
          <AdminRow
            key={item.id}
            title={item.label}
            meta={`${item.locationKeys.length} мест · ${item.enabled ? "включено" : "скрыто"}`}
            onEdit={() => edit(item)}
            disabled={pending}
        onDelete={() => remove(item.id)}
          />
        ))}
      </AdminList>
    </div>
  );
}

