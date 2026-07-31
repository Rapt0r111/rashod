"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { SearchSortControl } from "@/components/search-sort-control";
import type { Person, Snapshot } from "../../types";
import { fetchJson, getApiErrorMessage } from "../../api";
import { conscriptionLabel } from "../../utils";
import { SelectField } from "@/components/select-field";
import { filterListItems, sortListItems, type ListSortState } from "@/components/list-utils";
import { AdminList, AdminRow, FormGrid, fieldClass, submitClass } from "./admin-shared";

export function PeopleAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState({
    name: "",
    rank: "",
    conscriptionNumber: "",
    platoonId: snapshot.platoons[0]?.id ?? "",
    location: snapshot.locations[0]?.key ?? "rota",
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);
  function edit(person: Person) {
    setEditing(person);
    setForm({
      name: person.name,
      rank: person.rank,
      conscriptionNumber: person.conscriptionNumber ?? "",
      platoonId: person.platoonId,
      location: snapshot.locations.some((location) => location.key === person.location)
        ? person.location
        : snapshot.locations[0]?.key ?? "rota",
    });
  }
  async function save() {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      const result = await fetchJson<Snapshot>("/api/people", {
        method: "POST",
        body: JSON.stringify({ ...form, id: editing?.id }),
      });
      onSaved(result);
      setEditing(null);
      setForm({
        name: "",
        rank: "",
        conscriptionNumber: "",
        platoonId: snapshot.platoons[0]?.id ?? "",
        location: snapshot.locations[0]?.key ?? "rota",
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Сохранение не выполнено"));
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
        await fetchJson<Snapshot>("/api/people", {
          method: "DELETE",
          body: JSON.stringify({ id }),
        }),
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Удаление не выполнено"));
    } finally {
      setPending(false);
    }
  }
  const visiblePeople = useMemo(() => sortListItems(
    filterListItems(snapshot.people, query, (person) => `${person.name} ${person.rank} ${person.conscriptionNumber ?? ""}`),
    sort,
    { label: (person) => person.name, rank: (person) => person.rank, defaultCompare: (a, b) => a.sortOrder - b.sortOrder },
  ), [query, snapshot.people, sort]);
  return (
    <div className="overflow-auto px-4 pb-4.5 pt-3">
      <FormGrid>
        <input className={fieldClass}
          aria-label="ФИО"
          placeholder="ФИО"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input className={fieldClass}
          aria-label="Звание"
          placeholder="Звание"
          value={form.rank}
          onChange={(e) => setForm({ ...form, rank: e.target.value })}
        />
        <input className={fieldClass}
          aria-label="Номер призыва"
          placeholder="Номер призыва"
          inputMode="numeric"
          maxLength={40}
          value={form.conscriptionNumber}
          onChange={(e) => setForm({ ...form, conscriptionNumber: e.target.value })}
        />
        <SelectField
          ariaLabel="Подразделение"
          value={form.platoonId}
          options={snapshot.platoons.map((p) => ({ label: p.label, value: p.id }))}
          onChange={(value) => setForm({ ...form, platoonId: value })}
          variant="admin"
        />
        <SelectField
          ariaLabel="Место"
          value={form.location}
          options={snapshot.locations.map((location) => ({ label: location.label, value: location.key }))}
          onChange={(value) => setForm({ ...form, location: value })}
          variant="admin"
        />
        {errorMessage && <p className="col-span-full m-0 text-xs text-red" role="alert">{errorMessage}</p>}
        <button
          className={submitClass}
          type="button"
          onClick={() => void save()}
          disabled={pending || !form.name || !form.rank}
        >
          <PlusIcon size={16} />
          {editing ? "Сохранить" : "Добавить"}
        </button>
      </FormGrid>
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        placeholder="Найти человека по ФИО, званию или номеру призыва"
        ariaLabel="Поиск и сортировка людей"
      />
      <AdminList>
        {visiblePeople.map((person) => (
          <AdminRow
            key={person.id}
            title={person.name}
            meta={`${person.rank}${person.conscriptionNumber ? ` · ${conscriptionLabel(person.conscriptionNumber)}` : ""}`}
            onEdit={() => edit(person)}
            disabled={pending}
            onDelete={() => remove(person.id)}
          />
        ))}
      </AdminList>
    </div>
  );
}

