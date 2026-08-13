"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DeviceMobileIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { PortalPageHeader } from "@/features/portal/PortalChrome";
import { useRealtimeDomain } from "@/features/realtime/RealtimeProvider";
import { hasPermission, type Permission } from "@/features/auth/permissions";
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
  ZgtConfirmDialog,
  ZgtDataPanel,
  ZgtDialog,
  ZgtEmptyState,
  ZgtField,
  ZgtFormSection,
  ZgtIconButton,
  ZgtInput,
  ZgtListLayout,
  ZgtMobileCard,
  ZgtPagination,
  ZgtPersonSearch,
  ZgtSearchField,
  ZgtSelectField,
  ZgtStatStrip,
  ZgtToggleChip,
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

function readKnownStatus(value: string | null): PhoneStatus | "" {
  if (PHONE_STATUSES.some((item) => item.value === value)) {
    return value as PhoneStatus;
  }
  return "";
}

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
  permissions,
  initialData,
}: {
  permissions: readonly Permission[];
  initialData: PhoneListResult;
}) {
  const canWrite = hasPermission({ permissions: [...permissions] }, "zgt:write");
  const searchParams = useSearchParams();

  const [data, setData] = useState(initialData);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(() =>
    readKnownStatus(searchParams.get("status")),
  );
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PhoneFormValues>(emptyForm);
  const [personQuery, setPersonQuery] = useState("");
  const [storageCell, setStorageCell] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  useRealtimeDomain(["zgt", "unknown"], () => {
    void reload(page);
  });

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
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setPersonQuery("");
    setFormError(null);
    setEditorOpen(true);
  }

  function openEdit(item: PhoneRecord) {
    setEditingId(item.id);
    setForm({
      personId: item.personId ?? "",
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
    setFormError(null);
    setEditorOpen(true);
  }

  async function saveForm() {
    if (!form.model.trim() || !form.personId) {
      setFormError("Укажите модель и владельца из реестра Расхода");
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      if (editingId) await postPhone({ action: "update", id: editingId, data: form });
      else await postPhone({ action: "create", data: form });
      setEditorOpen(false);
      setNotice(editingId ? "Карточка телефона обновлена" : "Телефон добавлен");
      await reload(page);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  async function removeItem() {
    if (!deleteTarget) return;
    setPending(true);
    try {
      await postPhone({ action: "delete", id: deleteTarget.id });
      setSelected((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      setNotice(`«${deleteTarget.name}» удалён`);
      setDeleteTarget(null);
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
    setPendingAction(kind);
    setError(null);
    try {
      const ids = [...selected];
      if (kind === "in") {
        await postPhone({
          action: "batch-check-in",
          data: { ids, storageCell: storageCell || undefined },
        });
        setNotice(`Сдано: ${ids.length}`);
      } else {
        await postPhone({ action: "batch-check-out", data: { ids } });
        setNotice(`Выдано: ${ids.length}`);
      }
      setSelected(new Set());
      setStorageCell("");
      await reload(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка массовой операции");
    } finally {
      setPending(false);
      setPendingAction(null);
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

  const phoneLabel = (item: PhoneRecord) =>
    [item.brand, item.model].filter(Boolean).join(" ") || item.model;

  const rowActions = (item: PhoneRecord) =>
    canWrite ? (
      <>
        <ZgtIconButton label="Изменить" onClick={() => openEdit(item)}>
          <PencilSimpleIcon size={16} aria-hidden />
        </ZgtIconButton>
        <ZgtIconButton
          label="Удалить"
          className="text-red hover:text-red"
          onClick={() => setDeleteTarget({ id: item.id, name: phoneLabel(item) })}
        >
          <TrashIcon size={16} aria-hidden />
        </ZgtIconButton>
      </>
    ) : null;

  return (
    <>
      <PortalPageHeader
        title="Личные телефоны"
        subtitle="Сдача и выдача. Владелец — из реестра Расхода."
      />
      <ZgtNav activePath="/zgt/phones" />

      <ZgtStatStrip
        className="sm:grid-cols-3 lg:grid-cols-3"
        items={statItems}
        onSelect={(id) => setStatus((current) => (current === id ? "" : id))}
      />

      <ZgtToolbar
        actions={
          canWrite ? (
            <button type="button" className={zgtBtnPrimaryClass} onClick={openCreate}>
              <PlusIcon size={16} weight="bold" aria-hidden />
              Добавить
            </button>
          ) : null
        }
      >
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
          <button type="button" className={zgtBtnGhostClass} onClick={clearFilters}>
            Сбросить фильтры
          </button>
        ) : null}
      </ZgtToolbar>

      {canWrite && selected.size > 0 ? (
        <ZgtBatchBar count={selected.size} onClear={() => setSelected(new Set())}>
          <ZgtField
            label="Ячейка хранения"
            hint="Нужна при сдаче. Можно оставить пустой."
            className="min-w-40"
          >
            <ZgtInput
              value={storageCell}
              onChange={(e) => setStorageCell(e.target.value)}
              placeholder="Напр. A-12"
            />
          </ZgtField>
          <button
            type="button"
            className={zgtBtnPrimaryClass}
            disabled={pending}
            onClick={() => void runBatch("in")}
          >
            {pendingAction === "in" ? "Сдача…" : "Сдать"}
          </button>
          <button
            type="button"
            className={zgtBtnSecondaryClass}
            disabled={pending}
            onClick={() => void runBatch("out")}
          >
            {pendingAction === "out" ? "Выдача…" : "Выдать"}
          </button>
        </ZgtBatchBar>
      ) : null}

      {error ? <ZgtAlert message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? (
        <ZgtAlert message={notice} tone="success" onDismiss={() => setNotice(null)} />
      ) : null}

      <ZgtDataPanel
        title="Телефоны"
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
                <button type="button" className={zgtBtnSecondaryClass} onClick={clearFilters}>
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
          <ZgtListLayout
            table={
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-bg-panel text-xs font-semibold text-text-muted">
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
                        <button
                          type="button"
                          className="cursor-pointer text-left font-semibold text-text-primary transition-colors hover:text-cyan"
                          onClick={() => openEdit(item)}
                        >
                          {item.personName ?? "Без владельца"}
                        </button>
                        <div className="text-xs text-text-muted">{item.personRank}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{phoneLabel(item)}</div>
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
                          <div className="flex justify-end gap-1">{rowActions(item)}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
            cards={
              <div>
                {canWrite ? (
                  <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                    <ZgtCheckbox
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected}
                      onChange={toggleAllVisible}
                      label="Выбрать все на странице"
                    />
                    <span className="text-xs font-semibold text-text-muted">Выбрать все на странице</span>
                  </div>
                ) : null}
                {data.items.map((item) => (
                  <ZgtMobileCard
                    key={item.id}
                    leading={
                      canWrite ? (
                        <ZgtCheckbox
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                          label={`Выбрать ${item.model}`}
                        />
                      ) : null
                    }
                    title={item.personName ?? "Без владельца"}
                    subtitle={item.personRank ?? undefined}
                    onOpen={() => openEdit(item)}
                    fields={[
                      { label: "Телефон", value: phoneLabel(item) },
                      {
                        label: "Статус",
                        value: (
                          <StatusBadge
                            label={phoneStatusLabel(item.status)}
                            tone={item.status === "checked_in" ? "green" : "amber"}
                          />
                        ),
                      },
                      { label: "IMEI", value: item.imei1 || "—" },
                      { label: "Ячейка", value: item.storageCell || "—" },
                    ]}
                    actions={rowActions(item)}
                  />
                ))}
              </div>
            }
          />
        )}
      </ZgtDataPanel>

      <ZgtDialog
        open={editorOpen}
        title={editingId ? "Редактирование телефона" : "Новый телефон"}
        description="Владелец обязателен — поиск по реестру Расхода."
        onClose={() => setEditorOpen(false)}
      >
        {formError ? <ZgtAlert message={formError} onDismiss={() => setFormError(null)} /> : null}
        <div className="grid gap-3">
          <ZgtFormSection title="Владелец">
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
          </ZgtFormSection>
          <ZgtFormSection title="Аппарат">
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
          </ZgtFormSection>
          <ZgtFormSection title="Идентификация">
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
          </ZgtFormSection>
          <ZgtFormSection title="Особенности">
            <div className="col-span-full flex flex-wrap gap-2">
              <ZgtToggleChip
                label="Камера"
                checked={form.hasCamera}
                onChange={(checked) => setForm((f) => ({ ...f, hasCamera: checked }))}
              />
              <ZgtToggleChip
                label="Диктофон"
                checked={form.hasVoiceRecorder}
                onChange={(checked) =>
                  setForm((f) => ({ ...f, hasVoiceRecorder: checked }))
                }
              />
            </div>
          </ZgtFormSection>
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

      <ZgtConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить телефон?"
        text={
          deleteTarget
            ? `«${deleteTarget.name}» будет удалён без возможности отмены.`
            : ""
        }
        pending={pending}
        onConfirm={() => void removeItem()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
