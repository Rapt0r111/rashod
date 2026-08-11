"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DeviceMobileIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { PortalChrome } from "@/features/portal/PortalChrome";
import { hasPermission, type Permission } from "@/features/auth/permissions";
import { hasRashodAccess, hasZgtAccess, type PortalModuleId } from "@/features/portal/modules";
import { ZgtNav } from "./ZgtNav";
import {
  PHONE_STATUSES,
  phoneStatusLabel,
  type PhoneFormValues,
  type PhoneListResult,
  type PhoneRecord,
  type PhoneStatus,
} from "./phones-types";
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
  ZgtToolbar,
  zgtBtnGhostClass,
  zgtBtnPrimaryClass,
  zgtBtnSecondaryClass,
} from "./ui";

const emptyForm = (): PhoneFormValues => ({
  personId: "",
  brand: "",
  model: "",
  color: "",
  imei1: "",
  imei2: "",
  serialNumber: "",
  hasCamera: false,
  hasVoiceRecorder: false,
  status: "checked_out",
  storageCell: "",
});

async function postPhone(body: unknown) {
  const response = await fetch("/api/zgt/phones", {
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

export function PhonesApp({
  displayName,
  permissions,
  initialData,
}: {
  displayName: string;
  permissions: readonly Permission[];
  initialData: PhoneListResult;
}) {
  const canWrite = hasPermission({ permissions: [...permissions] }, "zgt:write");
  const availableModuleIds: PortalModuleId[] = [];
  if (hasRashodAccess(permissions)) availableModuleIds.push("rashod");
  if (hasZgtAccess(permissions)) availableModuleIds.push("zgt");

  const [data, setData] = useState(initialData);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PhoneFormValues>(emptyForm);
  const [personQuery, setPersonQuery] = useState("");
  const [storageCell, setStorageCell] = useState("");
  const [pending, setPending] = useState(false);

  const filtersActive = Boolean(q || status);

  const reload = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL("/api/zgt/phones", window.location.origin);
        if (q) url.searchParams.set("q", q);
        if (status) url.searchParams.set("status", status);
        url.searchParams.set("page", String(nextPage));
        const response = await fetch(url.pathname + url.search, { cache: "no-store" });
        if (!response.ok) throw new Error("LOAD_FAILED");
        const result = (await response.json()) as PhoneListResult;
        setData(result);
        setPage(result.page);
      } catch {
        setError("Не удалось загрузить телефоны");
      } finally {
        setLoading(false);
      }
    },
    [page, q, status],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(1), 250);
    return () => window.clearTimeout(handle);
  }, [q, status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setPersonQuery("");
    setEditorOpen(true);
  }

  function openEdit(item: PhoneRecord) {
    setEditingId(item.id);
    setForm({
      personId: item.personId,
      brand: item.brand ?? "",
      model: item.model,
      color: item.color ?? "",
      imei1: item.imei1 ?? "",
      imei2: item.imei2 ?? "",
      serialNumber: item.serialNumber ?? "",
      hasCamera: item.hasCamera,
      hasVoiceRecorder: item.hasVoiceRecorder,
      status: item.status,
      storageCell: item.storageCell ?? "",
    });
    setPersonQuery(
      item.personName ? `${item.personRank ?? ""} ${item.personName}`.trim() : "",
    );
    setEditorOpen(true);
  }

  async function saveForm() {
    if (!form.model.trim() || !form.personId) {
      setError("Укажите модель и владельца из реестра Расхода");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (editingId) await postPhone({ action: "update", id: editingId, data: form });
      else await postPhone({ action: "create", data: form });
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
      await postPhone({ action: "delete", id });
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

  async function runBatch(kind: "in" | "out") {
    if (!selected.size) return;
    setPending(true);
    setError(null);
    try {
      const ids = [...selected];
      if (kind === "in") {
        await postPhone({
          action: "batch-check-in",
          data: { ids, storageCell: storageCell || undefined },
        });
      } else {
        await postPhone({ action: "batch-check-out", data: { ids } });
      }
      setSelected(new Set());
      setStorageCell("");
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
        id: "checked_in",
        label: "Сдано",
        value: data.stats.checkedIn,
        tone: "green",
        active: status === "checked_in",
      },
      {
        id: "checked_out",
        label: "На руках",
        value: data.stats.checkedOut,
        tone: "amber",
        active: status === "checked_out",
      },
    ],
    [data.stats, status],
  );

  return (
    <PortalChrome
      activeModule="zgt"
      displayName={displayName}
      availableModuleIds={availableModuleIds}
      title="Личные телефоны"
      subtitle="Сдача и выдача. Владелец — из реестра Расхода."
    >
      <ZgtNav activePath="/zgt/phones" />

      <ZgtStatStrip
        className="sm:grid-cols-3 lg:grid-cols-3"
        items={statItems}
        onSelect={(id) => setStatus((current) => (current === id ? "" : id))}
      />

      <ZgtToolbar>
        <ZgtSearchField
          value={q}
          onChange={setQ}
          placeholder="Владелец, IMEI, модель…"
        />
        <ZgtSelectField label="Статус" value={status} onChange={setStatus}>
          <option value="">Все</option>
          {PHONE_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </ZgtSelectField>
        {filtersActive ? (
          <button
            type="button"
            className={zgtBtnGhostClass}
            onClick={() => {
              setQ("");
              setStatus("");
            }}
          >
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
          <ZgtField label="Ячейка хранения" className="min-w-40">
            <ZgtInput
              value={storageCell}
              onChange={(e) => setStorageCell(e.target.value)}
              placeholder="Напр. A-12"
            />
          </ZgtField>
          <button
            type="button"
            className={zgtBtnSecondaryClass}
            disabled={pending}
            onClick={() => void runBatch("in")}
          >
            Сдать
          </button>
          <button
            type="button"
            className={zgtBtnSecondaryClass}
            disabled={pending}
            onClick={() => void runBatch("out")}
          >
            Выдать
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
            icon={DeviceMobileIcon}
            title={filtersActive ? "Ничего не найдено" : "Телефоны не заведены"}
            text={
              filtersActive
                ? "Измените поиск или сбросьте фильтры."
                : canWrite
                  ? "Добавьте телефон и привяжите владельца из Расхода."
                  : "Записи появятся после внесения оператором."
            }
            action={
              filtersActive ? (
                <button
                  type="button"
                  className={zgtBtnSecondaryClass}
                  onClick={() => {
                    setQ("");
                    setStatus("");
                  }}
                >
                  Сбросить фильтры
                </button>
              ) : canWrite ? (
                <button type="button" className={zgtBtnPrimaryClass} onClick={openCreate}>
                  <PlusIcon size={16} weight="bold" aria-hidden />
                  Добавить телефон
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
                <th className="px-3 py-2 font-semibold">Владелец</th>
                <th className="px-3 py-2 font-semibold">Телефон</th>
                <th className="px-3 py-2 font-semibold">IMEI</th>
                <th className="px-3 py-2 font-semibold">Статус</th>
                <th className="px-3 py-2 font-semibold">Ячейка</th>
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
                        label={`Выбрать ${item.model}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{item.personName}</div>
                    <div className="text-xs text-text-muted">{item.personRank}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">
                      {[item.brand, item.model].filter(Boolean).join(" ")}
                    </div>
                    <div className="text-xs text-text-muted">
                      {item.color || "—"} · {item.hasCamera ? "камера" : "без кам."}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
                    {item.imei1 || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      label={phoneStatusLabel(item.status)}
                      tone={item.status === "checked_in" ? "green" : "amber"}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">
                    {item.storageCell || "—"}
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
                          onClick={() => void removeItem(item.id, item.model)}
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
        title={editingId ? "Редактирование телефона" : "Новый телефон"}
        description="Владелец обязателен — поиск по реестру Расхода."
        onClose={() => setEditorOpen(false)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ZgtPersonSearch
              label="Владелец"
              required
              query={personQuery}
              onQueryChange={setPersonQuery}
              selectedId={form.personId || null}
              onSelect={(person) => {
                setForm((f) => ({ ...f, personId: person.id }));
                setPersonQuery(`${person.rank} ${person.name}`);
              }}
              onClear={() => setForm((f) => ({ ...f, personId: "" }))}
            />
          </div>
          <ZgtField label="Бренд">
            <ZgtInput
              value={form.brand ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="Модель" required>
            <ZgtInput
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              required
            />
          </ZgtField>
          <ZgtField label="Цвет">
            <ZgtInput
              value={form.color ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </ZgtField>
          <ZgtSelectField
            label="Статус"
            value={form.status}
            onChange={(value) =>
              setForm((f) => ({ ...f, status: value as PhoneStatus }))
            }
          >
            {PHONE_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </ZgtSelectField>
          <ZgtField label="IMEI 1">
            <ZgtInput
              value={form.imei1 ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, imei1: e.target.value }))}
              inputMode="numeric"
            />
          </ZgtField>
          <ZgtField label="IMEI 2">
            <ZgtInput
              value={form.imei2 ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, imei2: e.target.value }))}
              inputMode="numeric"
            />
          </ZgtField>
          <ZgtField label="Серийный">
            <ZgtInput
              value={form.serialNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="Ячейка">
            <ZgtInput
              value={form.storageCell ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, storageCell: e.target.value }))}
            />
          </ZgtField>
          <label className="flex min-h-[42px] items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--cyan)]"
              checked={form.hasCamera}
              onChange={(e) => setForm((f) => ({ ...f, hasCamera: e.target.checked }))}
            />
            Камера
          </label>
          <label className="flex min-h-[42px] items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--cyan)]"
              checked={form.hasVoiceRecorder}
              onChange={(e) =>
                setForm((f) => ({ ...f, hasVoiceRecorder: e.target.checked }))
              }
            />
            Диктофон
          </label>
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
            disabled={pending || !form.model.trim() || !form.personId}
            onClick={() => void saveForm()}
          >
            {pending ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </ZgtDialog>
    </PortalChrome>
  );
}
