"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { SearchSortControl, type SearchSortOption } from "@/components/search-sort-control";
import type { LocationOption, Snapshot } from "../../types";
import { fetchJson, getApiErrorMessage } from "../../api";
import { SelectField } from "@/components/select-field";
import { filterListItems, sortListItems, type ListSortState } from "@/components/list-utils";
import { AdminList, AdminRow, FormGrid, fieldClass, submitClass, referenceSortOptions } from "./admin-shared";
import { StyledCheckbox } from "./styled-checkbox";

export function LocationAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState<LocationOption | null>(null);
  const [form, setForm] = useState({
    label: "",
    colorToken: "neutral",
    isQuick: false,
    quickCode: "",
    countsAsPresent: false,
  });
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
        await fetchJson<Snapshot>("/api/locations", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          id: editing?.id,
          quickCode: form.quickCode || null,
        }),
        }),
      );
      setEditing(null);
      setForm({
        label: "",
        colorToken: "neutral",
        isQuick: false,
        quickCode: "",
        countsAsPresent: false,
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Локация не сохранена"));
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
        await fetchJson<Snapshot>("/api/locations", {
        method: "DELETE",
        body: JSON.stringify({ id }),
        }),
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Локация не удалена"));
    } finally {
      setPending(false);
    }
  }
  const visibleLocations = useMemo(() => sortListItems(
    filterListItems(snapshot.locations, query, (item) => `${item.label} ${item.colorToken} ${item.quickCode ?? ""}`),
    sort,
    { label: (item) => item.label, defaultCompare: (a, b) => a.sortOrder - b.sortOrder },
  ), [query, snapshot.locations, sort]);
  return (
    <div className="overflow-auto px-4 pb-4.5 pt-3">
      <FormGrid>
        <input className={fieldClass}
          aria-label="Название локации"
          placeholder="Название локации"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <SelectField
          ariaLabel="Цвет"
          value={form.colorToken}
          options={["neutral", "green", "blue", "amber", "cyan", "red", "violet"].map(
            (tone) => ({ label: tone, value: tone }),
          )}
          onChange={(value) => setForm({ ...form, colorToken: value })}
          variant="admin"
        />
        <StyledCheckbox
          checked={form.isQuick}
          label="Быстрая"
          onChange={(checked) => setForm({ ...form, isQuick: checked })}
        />
        <StyledCheckbox
          checked={form.countsAsPresent}
          label="В расположении"
          onChange={(checked) => setForm({ ...form, countsAsPresent: checked })}
        />
        <input className={fieldClass}
          aria-label="Код"
          placeholder="Код"
          maxLength={2}
          value={form.quickCode}
          onChange={(e) =>
            setForm({
              ...form,
              quickCode: e.target.value.toLocaleUpperCase("ru-RU"),
            })
          }
        />
        <button className={submitClass} type="button" onClick={() => void save()} disabled={pending || !form.label.trim()}>
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
        placeholder="Найти локацию"
        ariaLabel="Поиск локаций"
      />
      <AdminList>
        {visibleLocations.map((item) => (
          <AdminRow
            key={item.id}
            title={item.label}
            meta={`${item.colorToken}${item.isQuick ? `, ${item.quickCode}` : ""}${item.countsAsPresent ? ", налицо" : ""}`}
            onEdit={() => {
              setEditing(item);
              setForm({
                label: item.label,
                colorToken: item.colorToken,
                isQuick: item.isQuick,
                quickCode: item.quickCode ?? "",
                countsAsPresent: item.countsAsPresent,
              });
            }}
            onDelete={item.isSystem ? undefined : () => remove(item.id)}
          />
        ))}
      </AdminList>
    </div>
  );
}



