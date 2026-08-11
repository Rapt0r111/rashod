"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UsbIcon,
} from "@phosphor-icons/react";
import { PortalPageHeader } from "@/features/portal/PortalChrome";
import { hasPermission, type Permission } from "@/features/auth/permissions";
import { ZgtNav } from "./ZgtNav";
import {
  STORAGE_ITEM_STATUSES,
  STORAGE_ITEM_TYPES,
  storageItemStatusLabel,
  storageItemTypeLabel,
  type StorageItemFormValues,
  type StorageItemListResult,
  type StorageItemRecord,
  type StorageItemStatus,
  type StorageItemType,
} from "./storage-items-types";
import {
  StatusBadge,
  ZgtAlert,
  ZgtBatchBar,
  ZgtCheckbox,
  ZgtDataPanel,
  ZgtDialog,
  ZgtEmptyState,
  ZgtField,
  ZgtIconButton,
  ZgtInput,
  ZgtPagination,
  ZgtPersonSearch,
  ZgtSearchField,
  ZgtSelectField,
  ZgtStatStrip,
  ZgtTextarea,
  ZgtToolbar,
  zgtBtnGhostClass,
  zgtBtnPrimaryClass,
  zgtBtnSecondaryClass,
} from "./ui";

const emptyForm = (): StorageItemFormValues => ({
  type: "flash_drive",
  inventoryNumber: "",
  serialNumber: "",
  capacityGb: null,
  accessLevel: null,
  status: "stock",
  personId: null,
  notes: "",
});

function statusTone(status: StorageItemStatus) {
  return STORAGE_ITEM_STATUSES.find((item) => item.value === status)?.tone ?? "blue";
}

async function postItem(body: unknown) {
  const response = await fetch("/api/zgt/storage-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `HTTP_${response.status}`);
  }
  return response.json();
}

export function StorageItemsApp({
  permissions,
  initialData,
}: {
  permissions: readonly Permission[];
  initialData: StorageItemListResult;
}) {
  const canWrite = hasPermission({ permissions: [...permissions] }, "zgt:write");

  const [data, setData] = useState(initialData);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StorageItemFormValues>(emptyForm);
  const [personQuery, setPersonQuery] = useState("");
  const [issuePersonId, setIssuePersonId] = useState<string | null>(null);
  const [issuePersonQuery, setIssuePersonQuery] = useState("");
  const [pending, setPending] = useState(false);

  const filtersActive = Boolean(q || status || type);

  const reload = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL("/api/zgt/storage-items", window.location.origin);
        if (q) url.searchParams.set("q", q);
        if (status) url.searchParams.set("status", status);
        if (type) url.searchParams.set("type", type);
        url.searchParams.set("page", String(nextPage));
        const response = await fetch(url.pathname + url.search, { cache: "no-store" });
        if (!response.ok) throw new Error("LOAD_FAILED");
        const result = (await response.json()) as StorageItemListResult;
        setData(result);
        setPage(result.page);
      } catch {
        setError("Не удалось загрузить носители");
      } finally {
        setLoading(false);
      }
    },
    [page, q, status, type],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(1), 250);
    return () => window.clearTimeout(handle);
  }, [q, status, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const allVisibleSelected =
    data.items.length > 0 && data.items.every((item) => selected.has(item.id));
  const someVisibleSelected =
    data.items.some((item) => selected.has(item.id)) && !allVisibleSelected;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const item of data.items) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setType("");
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setPersonQuery("");
    setEditorOpen(true);
  }

  function openEdit(item: StorageItemRecord) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      inventoryNumber: item.inventoryNumber ?? "",
      serialNumber: item.serialNumber ?? "",
      capacityGb: item.capacityGb,
      accessLevel: item.accessLevel,
      status: item.status,
      personId: item.personId,
      notes: item.notes,
    });
    setPersonQuery(
      item.personName ? `${item.personRank ?? ""} ${item.personName}`.trim() : "",
    );
    setEditorOpen(true);
  }

  async function saveForm() {
    setPending(true);
    setError(null);
    try {
      if (editingId) await postItem({ action: "update", id: editingId, data: form });
      else await postItem({ action: "create", data: form });
      setEditorOpen(false);
      await reload(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  async function removeItem(id: string, label: string) {
    if (!confirm(`Удалить «${label}»?`)) return;
    setPending(true);
    try {
      await postItem({ action: "delete", id });
      setSelected((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await reload(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить");
    } finally {
      setPending(false);
    }
  }

  async function runBatch(kind: "issue" | "return") {
    if (!selected.size) return;
    setPending(true);
    setError(null);
    try {
      const ids = [...selected];
      if (kind === "issue") {
        if (!issuePersonId) {
          setError("Выберите человека из Расхода для выдачи");
          return;
        }
        await postItem({
          action: "batch-issue",
          data: { ids, toPersonId: issuePersonId },
        });
      } else {
        await postItem({ action: "batch-return", data: { ids } });
      }
      setSelected(new Set());
      setIssuePersonId(null);
      setIssuePersonQuery("");
      await reload(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка массовой операции");
    } finally {
      setPending(false);
    }
  }

  const statItems = useMemo(
    () => [
      { id: "", label: "Всего", value: data.stats.total, active: status === "" },
      {
        id: "stock",
        label: "Склад",
        value: data.stats.stock,
        active: status === "stock",
      },
      {
        id: "in_use",
        label: "Выдано",
        value: data.stats.inUse,
        tone: "blue",
        active: status === "in_use",
      },
      {
        id: "broken",
        label: "Неисправны",
        value: data.stats.broken,
        tone: "amber",
        active: status === "broken",
      },
      {
        id: "lost",
        label: "Утрачены",
        value: data.stats.lost,
        tone: "red",
        active: status === "lost",
      },
    ],
    [data.stats, status],
  );

  return (
    <>
      <PortalPageHeader
        title="Носители и пропуска"
        subtitle="Флеш-накопители и электронные пропуска. Выдача — на людей из Расхода."
      />
      <ZgtNav activePath="/zgt/storage-items" />

      <ZgtStatStrip
        items={statItems}
        onSelect={(id) => setStatus((current) => (current === id ? "" : id))}
      />

      <ZgtToolbar>
        <ZgtSearchField
          value={q}
          onChange={setQ}
          placeholder="Инв. №, серийный, владелец…"
        />
        <ZgtSelectField label="Тип" value={type} onChange={setType}>
          <option value="">Все</option>
          {STORAGE_ITEM_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </ZgtSelectField>
        <ZgtSelectField label="Статус" value={status} onChange={setStatus}>
          <option value="">Все</option>
          {STORAGE_ITEM_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </ZgtSelectField>
        {filtersActive ? (
          <button type="button" className={zgtBtnGhostClass} onClick={clearFilters}>
            Сбросить фильтры
          </button>
        ) : null}
        {canWrite ? (
          <button type="button" className={zgtBtnPrimaryClass} onClick={openCreate}>
            <PlusIcon size={16} weight="bold" aria-hidden />
            Добавить
          </button>
        ) : null}
      </ZgtToolbar>

      {canWrite && selected.size > 0 ? (
        <ZgtBatchBar count={selected.size} onClear={() => setSelected(new Set())}>
          <div className="min-w-56 flex-1">
            <ZgtPersonSearch
              label="Кому выдать"
              query={issuePersonQuery}
              onQueryChange={setIssuePersonQuery}
              selectedId={issuePersonId}
              onSelect={(person) => {
                setIssuePersonId(person.id);
                setIssuePersonQuery(`${person.rank} ${person.name}`);
              }}
              onClear={() => setIssuePersonId(null)}
            />
          </div>
          <button
            type="button"
            className={zgtBtnSecondaryClass}
            disabled={pending}
            onClick={() => void runBatch("issue")}
          >
            Выдать
          </button>
          <button
            type="button"
            className={zgtBtnSecondaryClass}
            disabled={pending}
            onClick={() => void runBatch("return")}
          >
            Вернуть
          </button>
        </ZgtBatchBar>
      ) : null}

      {error ? <ZgtAlert message={error} onDismiss={() => setError(null)} /> : null}

      <ZgtDataPanel
        title="Список"
        total={data.total}
        loading={loading}
        footer={
          <ZgtPagination
            page={data.page}
            pageCount={data.pageCount}
            loading={loading}
            onPrev={() => void reload(page - 1)}
            onNext={() => void reload(page + 1)}
          />
        }
      >
        {data.items.length === 0 ? (
          <ZgtEmptyState
            icon={UsbIcon}
            title={filtersActive ? "Ничего не найдено" : "Носители не заведены"}
            text={
              filtersActive
                ? "Измените поиск или сбросьте фильтры."
                : canWrite
                  ? "Добавьте флеш-накопитель или электронный пропуск."
                  : "Записи появятся после внесения оператором."
            }
            action={
              filtersActive ? (
                <button type="button" className={zgtBtnSecondaryClass} onClick={clearFilters}>
                  Сбросить фильтры
                </button>
              ) : canWrite ? (
                <button type="button" className={zgtBtnPrimaryClass} onClick={openCreate}>
                  <PlusIcon size={16} weight="bold" aria-hidden />
                  Добавить запись
                </button>
              ) : null
            }
          />
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs font-semibold text-text-muted">
              <tr>
                {canWrite ? (
                  <th className="w-12 px-2 py-2 font-semibold">
                    <ZgtCheckbox
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected}
                      onChange={toggleAllVisible}
                      label="Выбрать все на странице"
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2 font-semibold">Тип</th>
                <th className="px-3 py-2 font-semibold">Инв. / серийный</th>
                <th className="px-3 py-2 font-semibold">Статус</th>
                <th className="px-3 py-2 font-semibold">Кому</th>
                <th className="px-3 py-2 font-semibold">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-line/80 transition-colors duration-150 hover:bg-white/[0.025]"
                >
                  {canWrite ? (
                    <td className="px-2 py-1.5">
                      <ZgtCheckbox
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        label={`Выбрать ${item.inventoryNumber || item.type}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 font-semibold">
                    {storageItemTypeLabel(item.type)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-xs tabular-nums">
                      {item.inventoryNumber || "—"}
                    </div>
                    <div className="text-xs text-text-muted">
                      {item.serialNumber || "без S/N"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      label={storageItemStatusLabel(item.status)}
                      tone={statusTone(item.status)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">
                    {item.personName ? (
                      <>
                        <div>{item.personName}</div>
                        <div className="text-xs text-text-muted">{item.personRank}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {canWrite ? (
                      <div className="flex justify-end gap-1">
                        <ZgtIconButton label="Изменить" onClick={() => openEdit(item)}>
                          <PencilSimpleIcon size={16} aria-hidden />
                        </ZgtIconButton>
                        <ZgtIconButton
                          label="Удалить"
                          className="text-red hover:text-red"
                          onClick={() =>
                            void removeItem(item.id, item.inventoryNumber || item.type)
                          }
                        >
                          <TrashIcon size={16} aria-hidden />
                        </ZgtIconButton>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ZgtDataPanel>

      <ZgtDialog
        open={editorOpen}
        title={editingId ? "Редактирование" : "Новая запись"}
        description="При выдаче выберите человека из реестра Расхода."
        onClose={() => setEditorOpen(false)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ZgtSelectField
            label="Тип"
            value={form.type}
            onChange={(value) =>
              setForm((f) => ({ ...f, type: value as StorageItemType }))
            }
          >
            {STORAGE_ITEM_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </ZgtSelectField>
          <ZgtSelectField
            label="Статус"
            value={form.status}
            onChange={(value) =>
              setForm((f) => ({ ...f, status: value as StorageItemStatus }))
            }
          >
            {STORAGE_ITEM_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </ZgtSelectField>
          <ZgtField label="Инв. №">
            <ZgtInput
              value={form.inventoryNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, inventoryNumber: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="Серийный">
            <ZgtInput
              value={form.serialNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="Ёмкость, ГБ">
            <ZgtInput
              type="number"
              min={1}
              value={form.capacityGb ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  capacityGb: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </ZgtField>
          <ZgtField label="Уровень доступа">
            <ZgtInput
              type="number"
              min={0}
              max={99}
              value={form.accessLevel ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  accessLevel: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </ZgtField>
          <div className="sm:col-span-2">
            <ZgtPersonSearch
              label="Кому"
              query={personQuery}
              onQueryChange={setPersonQuery}
              selectedId={form.personId}
              onSelect={(person) => {
                setForm((f) => ({ ...f, personId: person.id, status: "in_use" }));
                setPersonQuery(`${person.rank} ${person.name}`);
                setIssuePersonId(person.id);
                setIssuePersonQuery(`${person.rank} ${person.name}`);
              }}
              onClear={() => setForm((f) => ({ ...f, personId: null }))}
            />
          </div>
          <ZgtField label="Заметки" className="sm:col-span-2">
            <ZgtTextarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </ZgtField>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={zgtBtnSecondaryClass}
            onClick={() => setEditorOpen(false)}
          >
            Отмена
          </button>
          <button
            type="button"
            className={zgtBtnPrimaryClass}
            disabled={pending}
            onClick={() => void saveForm()}
          >
            {pending ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </ZgtDialog>
    </>
  );
}
