"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { SearchSortControl, type SearchSortOption } from "@/components/search-sort-control";
import type { Platoon, Snapshot } from "../../types";
import { fetchJson, getApiErrorMessage } from "../../api";
import { filterListItems, sortListItems, type ListSortState } from "@/components/list-utils";
import { AdminList, AdminRow, FormGrid, fieldClass, submitClass, referenceSortOptions } from "./admin-shared";

export function PlatoonAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState<Platoon | null>(null);
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  async function save() {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/platoons", {
        method: "POST",
        body: JSON.stringify({
          id: editing?.id,
          label,
        }),
        }),
      );
      setEditing(null);
      setLabel("");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Подразделение не сохранено"));
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/platoons", {
        method: "DELETE",
        body: JSON.stringify({ id }),
        }),
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Подразделение не удалено"));
    } finally {
      setPending(false);
    }
  }
  const visiblePlatoons = useMemo(() => sortListItems(
    filterListItems(snapshot.platoons, query, (item) => `${item.label} ${item.isSystem ? "системное" : "пользовательское"}`),
    sort,
    { label: (item) => item.label, defaultCompare: (a, b) => a.sortOrder - b.sortOrder },
  ), [query, snapshot.platoons, sort]);
  return (
    <div className="overflow-auto px-4 pb-4.5 pt-3">
      <FormGrid>
        <input className={fieldClass}
          aria-label="Название подразделения"
          placeholder="Название подразделения"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className={submitClass} type="button" onClick={save} disabled={pending || !label.trim()}>
          <PlusIcon size={16} />
          {editing ? "Сохранить" : "Добавить"}
        </button>
      </FormGrid>
      {errorMessage && <p className="m-0 text-xs text-red" role="alert">{errorMessage}</p>}
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        options={referenceSortOptions}
        showSort={false}
        placeholder="Найти подразделение"
        ariaLabel="Поиск подразделений"
      />
      <AdminList>
        {visiblePlatoons.map((item) => (
          <AdminRow
            key={item.id}
            title={item.label}
            meta={item.isSystem ? "системное" : "пользовательское"}
            onEdit={() => {
              setEditing(item);
              setLabel(item.label);
            }}
            disabled={pending}
            onDelete={item.isSystem ? undefined : () => remove(item.id)}
          />
        ))}
      </AdminList>
    </div>
  );
}

