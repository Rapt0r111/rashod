"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  DesktopTowerIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { PortalPageHeader } from "@/features/portal/PortalChrome";
import type { Permission } from "@/features/auth/permissions";
import { hasPermission } from "@/features/auth/permissions";
import {
  batchIssue,
  batchMove,
  batchReturn,
  createEquipmentItem,
  deleteEquipmentItem,
  fetchEquipmentDetail,
  fetchEquipmentList,
  updateEquipmentItem,
} from "./api";
import {
  DEVICE_TYPES,
  EQUIPMENT_STATUSES,
  TRANSFER_TYPES,
  deviceTypeLabel,
  statusLabel,
  type EquipmentDetail,
  type EquipmentFormValues,
  type EquipmentListResult,
  type EquipmentRecord,
  type EquipmentStatus,
} from "./types";
import { ZgtNav } from "./ZgtNav";
import {
  InfoTile,
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

const emptyForm = (): EquipmentFormValues => ({
  deviceType: "laptop",
  displayName: "",
  inventoryNumber: undefined,
  serialNumber: undefined,
  mniSerialNumber: undefined,
  manufacturer: undefined,
  model: undefined,
  cpu: undefined,
  ramGb: null,
  storageType: null,
  storageGb: null,
  os: undefined,
  status: "storage",
  isWorking: true,
  location: undefined,
  personId: null,
  hasCharger: null,
  isChargerWorking: null,
  hasMouse: null,
  isMouseWorking: null,
  hasBag: null,
});

function statusTone(status: EquipmentStatus) {
  return EQUIPMENT_STATUSES.find((item) => item.value === status)?.tone ?? "neutral";
}

export function EquipmentApp({
  permissions,
  initialData,
}: {
  permissions: readonly Permission[];
  initialData: EquipmentListResult;
}) {
  const canWrite = hasPermission({ permissions: [...permissions] }, "zgt:write");

  const [data, setData] = useState(initialData);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EquipmentFormValues>(emptyForm);
  const [detail, setDetail] = useState<EquipmentDetail | null>(null);
  const [personQuery, setPersonQuery] = useState("");
  const [batchLocation, setBatchLocation] = useState("");
  const [batchPersonId, setBatchPersonId] = useState<string | null>(null);
  const [batchPersonQuery, setBatchPersonQuery] = useState("");
  const [pending, setPending] = useState(false);

  const filtersActive = Boolean(q || status || category || location);

  const reload = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEquipmentList({
          q,
          status,
          category,
          location,
          page: nextPage,
        });
        setData(result);
        setPage(result.page);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Не удалось загрузить список");
      } finally {
        setLoading(false);
      }
    },
    [category, location, page, q, status],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void reload(1);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [q, status, category, location]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setCategory("");
    setLocation("");
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setPersonQuery("");
    setEditorOpen(true);
  }

  function openEdit(item: EquipmentRecord) {
    setEditingId(item.id);
    setForm({
      deviceType: item.deviceType,
      displayName: item.displayName,
      inventoryNumber: item.inventoryNumber ?? undefined,
      serialNumber: item.serialNumber ?? undefined,
      mniSerialNumber: item.mniSerialNumber ?? undefined,
      manufacturer: item.manufacturer ?? undefined,
      model: item.model ?? undefined,
      cpu: item.cpu ?? undefined,
      ramGb: item.ramGb,
      storageType: (item.storageType as EquipmentFormValues["storageType"]) ?? null,
      storageGb: item.storageGb,
      os: item.os ?? undefined,
      status: item.status,
      isWorking: item.isWorking,
      location: item.location ?? undefined,
      personId: item.personId,
      hasCharger: item.hasCharger,
      isChargerWorking: item.isChargerWorking,
      hasMouse: item.hasMouse,
      isMouseWorking: item.isMouseWorking,
      hasBag: item.hasBag,
    });
    setPersonQuery(item.personName ?? "");
    setEditorOpen(true);
  }

  async function openDetail(id: string) {
    try {
      setDetail(await fetchEquipmentDetail(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось открыть карточку");
    }
  }

  async function saveForm() {
    if (!form.displayName.trim()) {
      setError("Укажите название техники");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (editingId) await updateEquipmentItem(editingId, form);
      else await createEquipmentItem(form);
      setEditorOpen(false);
      setSelected(new Set());
      await reload(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  async function removeItem(id: string, name: string) {
    if (!confirm(`Удалить «${name}»?`)) return;
    setPending(true);
    try {
      await deleteEquipmentItem(id);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      if (detail?.id === id) setDetail(null);
      await reload(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить");
    } finally {
      setPending(false);
    }
  }

  async function runBatch(kind: "issue" | "return" | "move") {
    if (!selected.size) return;
    setPending(true);
    setError(null);
    try {
      const ids = [...selected];
      if (kind === "issue") {
        await batchIssue({
          ids,
          toPersonId: batchPersonId,
          toLocation: batchLocation || undefined,
        });
      } else if (kind === "return") {
        await batchReturn({ ids });
      } else {
        if (!batchLocation.trim()) {
          setError("Укажите местоположение для перемещения");
          return;
        }
        await batchMove({ ids, toLocation: batchLocation.trim() });
      }
      setSelected(new Set());
      setBatchPersonId(null);
      setBatchPersonQuery("");
      setBatchLocation("");
      await reload(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка массовой операции");
    } finally {
      setPending(false);
    }
  }

  const statItems = useMemo(
    () => [
      {
        id: "",
        label: "Всего",
        value: data.stats.total,
        active: status === "",
      },
      {
        id: "in_use",
        label: "В работе",
        value: data.stats.inUse,
        tone: "blue",
        active: status === "in_use",
      },
      {
        id: "storage",
        label: "На складе",
        value: data.stats.storage,
        active: status === "storage",
      },
      {
        id: "repair",
        label: "Ремонт",
        value: data.stats.repair,
        tone: "amber",
        active: status === "repair",
      },
      {
        id: "broken",
        label: "Сломан",
        value: data.stats.broken,
        tone: "red",
        active: status === "broken",
      },
    ],
    [data.stats, status],
  );

  return (
    <>
      <PortalPageHeader
        title="Вычислительная техника"
        subtitle="Учёт ВТ. Владелец — человек из реестра Расхода."
      />
      <ZgtNav activePath="/zgt/equipment" />

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
        <ZgtSelectField label="Статус" value={status} onChange={setStatus}>
          <option value="">Все</option>
          {EQUIPMENT_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </ZgtSelectField>
        <ZgtSelectField label="Категория" value={category} onChange={setCategory}>
          <option value="">Все</option>
          <option value="workstation">ПЭВМ / АРМ</option>
          <option value="laptop">Ноутбуки</option>
          <option value="server">Серверы</option>
          <option value="other">Прочее</option>
        </ZgtSelectField>
        <ZgtSelectField label="Место" value={location} onChange={setLocation}>
          <option value="">Все</option>
          {data.locations.map((item) => (
            <option key={item} value={item}>
              {item}
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
              query={batchPersonQuery}
              onQueryChange={setBatchPersonQuery}
              selectedId={batchPersonId}
              onSelect={(person) => {
                setBatchPersonId(person.id);
                setBatchPersonQuery(`${person.rank} ${person.name}`);
              }}
              onClear={() => setBatchPersonId(null)}
            />
          </div>
          <ZgtField label="Местоположение" className="min-w-40">
            <ZgtInput
              value={batchLocation}
              onChange={(event) => setBatchLocation(event.target.value)}
              placeholder="Кабинет / склад"
            />
          </ZgtField>
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
            Сдать
          </button>
          <button
            type="button"
            className={zgtBtnSecondaryClass}
            disabled={pending}
            onClick={() => void runBatch("move")}
          >
            Переместить
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
            icon={DesktopTowerIcon}
            title={filtersActive ? "Ничего не найдено" : "Техника ещё не заведена"}
            text={
              filtersActive
                ? "Измените поиск или сбросьте фильтры."
                : canWrite
                  ? "Добавьте первую единицу учёта — ПЭВМ, ноутбук или сервер."
                  : "Записи появятся, когда оператор с правом записи их внесёт."
            }
            action={
              filtersActive ? (
                <button type="button" className={zgtBtnSecondaryClass} onClick={clearFilters}>
                  Сбросить фильтры
                </button>
              ) : canWrite ? (
                <button type="button" className={zgtBtnPrimaryClass} onClick={openCreate}>
                  <PlusIcon size={16} weight="bold" aria-hidden />
                  Добавить технику
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
                <th className="px-3 py-2 font-semibold">Название</th>
                <th className="px-3 py-2 font-semibold">Инв. №</th>
                <th className="px-3 py-2 font-semibold">Статус</th>
                <th className="px-3 py-2 font-semibold">Владелец</th>
                <th className="px-3 py-2 font-semibold">Место</th>
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
                        label={`Выбрать ${item.displayName}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="cursor-pointer text-left font-semibold text-text-primary transition-colors hover:text-cyan"
                      onClick={() => void openDetail(item.id)}
                    >
                      {item.displayName}
                    </button>
                    <div className="text-xs text-text-muted">
                      {deviceTypeLabel(item.deviceType)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
                    {item.inventoryNumber || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      label={statusLabel(item.status)}
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
                  <td className="px-3 py-2.5 text-text-secondary">
                    {item.location || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {canWrite ? (
                      <div className="flex justify-end gap-1">
                        <ZgtIconButton
                          label="Изменить"
                          onClick={() => openEdit(item)}
                        >
                          <PencilSimpleIcon size={16} aria-hidden />
                        </ZgtIconButton>
                        <ZgtIconButton
                          label="Удалить"
                          className="text-red hover:text-red"
                          onClick={() => void removeItem(item.id, item.displayName)}
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
        title={editingId ? "Редактирование техники" : "Новая техника"}
        description="Обязательно укажите название. Владельца выбирайте из реестра Расхода."
        onClose={() => setEditorOpen(false)}
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ZgtSelectField
            label="Тип"
            value={form.deviceType}
            onChange={(value) =>
              setForm((f) => ({
                ...f,
                deviceType: value as EquipmentFormValues["deviceType"],
              }))
            }
          >
            {DEVICE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </ZgtSelectField>
          <ZgtSelectField
            label="Статус"
            value={form.status}
            onChange={(value) =>
              setForm((f) => ({ ...f, status: value as EquipmentStatus }))
            }
          >
            {EQUIPMENT_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </ZgtSelectField>
          <ZgtField label="Название" required className="sm:col-span-2">
            <ZgtInput
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              required
            />
          </ZgtField>
          <ZgtField label="Инв. №">
            <ZgtInput
              value={form.inventoryNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, inventoryNumber: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="Серийный №">
            <ZgtInput
              value={form.serialNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="МНИ №">
            <ZgtInput
              value={form.mniSerialNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, mniSerialNumber: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="Местоположение">
            <ZgtInput
              value={form.location ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="Производитель">
            <ZgtInput
              value={form.manufacturer ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="Модель">
            <ZgtInput
              value={form.model ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="CPU">
            <ZgtInput
              value={form.cpu ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, cpu: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="ОС">
            <ZgtInput
              value={form.os ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, os: e.target.value }))}
            />
          </ZgtField>
          <ZgtField label="RAM, ГБ">
            <ZgtInput
              type="number"
              min={1}
              value={form.ramGb ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ramGb: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </ZgtField>
          <ZgtField label="Диск, ГБ">
            <ZgtInput
              type="number"
              min={1}
              value={form.storageGb ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  storageGb: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </ZgtField>
          <div className="sm:col-span-2">
            <ZgtPersonSearch
              query={personQuery}
              onQueryChange={setPersonQuery}
              selectedId={form.personId}
              onSelect={(person) => {
                setForm((f) => ({ ...f, personId: person.id }));
                setPersonQuery(`${person.rank} ${person.name}`);
                setBatchPersonId(person.id);
                setBatchPersonQuery(`${person.rank} ${person.name}`);
              }}
              onClear={() => setForm((f) => ({ ...f, personId: null }))}
            />
          </div>
          <label className="flex min-h-[42px] items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--cyan)]"
              checked={form.isWorking}
              onChange={(e) => setForm((f) => ({ ...f, isWorking: e.target.checked }))}
            />
            Исправен
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
            disabled={pending || !form.displayName.trim()}
            onClick={() => void saveForm()}
          >
            {pending ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </ZgtDialog>

      <ZgtDialog
        open={Boolean(detail)}
        title={detail?.displayName ?? "Карточка"}
        description={detail ? deviceTypeLabel(detail.deviceType) : undefined}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          <>
            <dl className="grid gap-2 sm:grid-cols-2">
              <InfoTile label="Статус" value={statusLabel(detail.status)} />
              <InfoTile label="Инв. №" value={detail.inventoryNumber || "—"} />
              <InfoTile label="Серийный" value={detail.serialNumber || "—"} />
              <InfoTile label="МНИ" value={detail.mniSerialNumber || "—"} />
              <InfoTile
                label="Владелец"
                value={
                  detail.personName
                    ? `${detail.personRank ?? ""} ${detail.personName}`.trim()
                    : "—"
                }
              />
              <InfoTile label="Место" value={detail.location || "—"} />
              <InfoTile label="Производитель" value={detail.manufacturer || "—"} />
              <InfoTile label="Модель" value={detail.model || "—"} />
              <InfoTile label="CPU" value={detail.cpu || "—"} />
              <InfoTile
                label="RAM"
                value={detail.ramGb ? `${detail.ramGb} ГБ` : "—"}
              />
            </dl>
            <h3 className="mb-2 mt-5 text-sm font-bold">История перемещений</h3>
            {detail.transfers.length === 0 ? (
              <p className="m-0 text-sm text-text-muted">Пока нет записей.</p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {detail.transfers.map((transfer) => (
                  <li
                    key={transfer.id}
                    className="rounded-[10px] border border-line bg-bg-raised/70 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {TRANSFER_TYPES.find((item) => item.value === transfer.type)
                        ?.label ?? transfer.type}
                      <ArrowRightIcon size={12} className="text-text-muted" aria-hidden />
                      <span className="font-normal text-text-secondary">
                        {transfer.toPersonName || transfer.toLocation || "—"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {new Date(transfer.transferredAt).toLocaleString("ru-RU")}
                      {transfer.createdByName ? ` · ${transfer.createdByName}` : ""}
                      {transfer.fromLocation ? ` · из ${transfer.fromLocation}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canWrite ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className={zgtBtnSecondaryClass}
                  onClick={() => {
                    setDetail(null);
                    openEdit(detail);
                  }}
                >
                  Редактировать
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </ZgtDialog>
    </>
  );
}
