"use client";

import { useMemo, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react";
import type { OverviewBlockId, OverviewBlockSettings, OverviewSelection, OverviewSettings, Snapshot } from "../../types";
import { fetchJson, getApiErrorMessage } from "../../api";
import { cx, peopleForPlatoon } from "../../utils";
import { SelectField } from "@/components/select-field";
import { overviewLocationMetrics } from "../../roster-metrics";
import { cloneDefaultOverviewSettings, mergeOverviewSettings, normalizeOverviewSettings, OVERVIEW_ACTIVITY_METRICS, OVERVIEW_BLOCKS, OVERVIEW_HERO_METRICS } from "../../overview-settings";
import { fieldClass, submitClass } from "./admin-shared";
import { StyledCheckbox } from "./styled-checkbox";

export function OverviewSettingsAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [baseForm, setBaseForm] = useState<OverviewSettings>(() => normalizeOverviewSettings(snapshot.overviewSettings));
  const [form, setForm] = useState<OverviewSettings>(() => normalizeOverviewSettings(snapshot.overviewSettings));
  const [draggedBlock, setDraggedBlock] = useState<OverviewBlockId | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const locationMetrics = useMemo(
    () => overviewLocationMetrics(snapshot.people, snapshot.locations, snapshot.locationGroups),
    [snapshot.people, snapshot.locations, snapshot.locationGroups],
  );
  const platoonItems = useMemo(
    () => snapshot.platoons.map((platoon) => ({
      key: platoon.id,
      label: platoon.label,
      count: peopleForPlatoon(snapshot.people, platoon.id).length,
    })),
    [snapshot.people, snapshot.platoons],
  );

  function updateBlock(id: OverviewBlockId, patch: Partial<{ visible: boolean; density: "standard" | "compact"; layout: "full" | "half" }>) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => block.id === id ? { ...block, ...patch } as OverviewBlockSettings : block),
    }));
  }

  function updateConfig(id: OverviewBlockId, patch: Record<string, unknown>) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => block.id === id ? { ...block, config: { ...block.config, ...patch } } as OverviewBlockSettings : block),
    }));
  }

  function updateSelection(id: OverviewBlockId, field: "locationSelection" | "platoonSelection", patch: Partial<OverviewSelection>) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== id) return block;
        const selection = (block.config as Record<string, unknown>)[field] as OverviewSelection;
        return { ...block, config: { ...block.config, [field]: { ...selection, ...patch } } } as OverviewBlockSettings;
      }),
    }));
  }

  function toggleSelection(id: OverviewBlockId, field: "locationSelection" | "platoonSelection", key: string) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== id) return block;
        const selection = (block.config as Record<string, unknown>)[field] as OverviewSelection;
        const keys = selection.keys.includes(key)
          ? selection.keys.filter((item) => item !== key)
          : [...selection.keys, key];
        return { ...block, config: { ...block.config, [field]: { ...selection, keys } } } as OverviewBlockSettings;
      }),
    }));
  }

  function toggleMetric(id: "hero" | "activity", key: string) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== id) return block;
        const metricKeys = block.config.metricKeys as string[];
        if (metricKeys.includes(key) && metricKeys.length === 1) return block;
        return { ...block, config: { ...block.config, metricKeys: metricKeys.includes(key) ? metricKeys.filter((item) => item !== key) : [...metricKeys, key] } } as OverviewBlockSettings;
      }),
    }));
  }

  function moveBlock(id: OverviewBlockId, direction: -1 | 1) {
    setForm((current) => {
      const index = current.blocks.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
      return { ...current, blocks };
    });
  }

  function dropBlock(targetId: OverviewBlockId) {
    if (!draggedBlock || draggedBlock === targetId) return;
    setForm((current) => {
      const from = current.blocks.findIndex((block) => block.id === draggedBlock);
      const to = current.blocks.findIndex((block) => block.id === targetId);
      if (from < 0 || to < 0) return current;
      const blocks = [...current.blocks];
      const moved = blocks.splice(from, 1)[0];
      if (!moved) return current;
      blocks.splice(to, 0, moved);
      return { ...current, blocks };
    });
    setDraggedBlock(null);
  }

  async function save() {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const latestSnapshot = await fetchJson<Snapshot>("/api/snapshot");
      const payload = mergeOverviewSettings(
        latestSnapshot.overviewSettings,
        baseForm,
        form,
      );
      const savedSnapshot = await fetchJson<Snapshot>("/api/overview-settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const savedSettings = normalizeOverviewSettings(savedSnapshot.overviewSettings);
      setBaseForm(savedSettings);
      setForm(savedSettings);
      onSaved(savedSnapshot);
      setSuccessMessage("Настройки обзора сохранены");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Настройки не сохранены"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-0 overflow-auto px-4 pt-3">
      <p className="mb-3 text-xs leading-5 text-text-muted">
        Настройки применяются ко всем пользователям. Для каждого блока отдельно задаются видимость, порядок, ширина, плотность и состав данных.
      </p>

      <div className="grid gap-2">
        {form.blocks.map((block, index) => {
          const label = OVERVIEW_BLOCKS.find((item) => item.id === block.id)?.label ?? block.id;
          return (
            <div
              className={cx("grid gap-3 rounded-xl border p-3 transition", block.visible ? "border-line bg-bg-raised" : "border-line bg-white/2 opacity-70")}
              key={block.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropBlock(block.id)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="cursor-grab select-none text-lg leading-none text-text-muted"
                  draggable
                  aria-label="Перетащить блок"
                  title="Перетащить блок"
                  onDragStart={() => setDraggedBlock(block.id)}
                  onDragEnd={() => setDraggedBlock(null)}
                >⋮⋮</span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">{label}</strong>
                  <span className="text-[11px] text-text-muted">Порядок {index + 1}</span>
                </div>
                <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-line text-text-secondary transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-35" type="button" aria-label="Переместить выше" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}><ArrowUpIcon size={15} /></button>
                <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-line text-text-secondary transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-35" type="button" aria-label="Переместить ниже" disabled={index === form.blocks.length - 1} onClick={() => moveBlock(block.id, 1)}><ArrowDownIcon size={15} /></button>
              </div>

              <div className="grid grid-cols-3 gap-2 max-[720px]:grid-cols-1">
                <StyledCheckbox checked={block.visible} label="Показывать блок" onChange={(visible) => updateBlock(block.id, { visible })} />
                <SelectField
                  ariaLabel={"Плотность блока «" + label + "»"}
                  value={block.density}
                  options={[{ label: "Обычный режим", value: "standard" }, { label: "Компактный режим", value: "compact" }]}
                  onChange={(density) => updateBlock(block.id, { density: density as "standard" | "compact" })}
                  variant="admin"
                />
                <SelectField
                  ariaLabel={"Ширина блока «" + label + "»"}
                  value={block.layout}
                  options={[{ label: "На всю ширину", value: "full" }, { label: "Половина строки", value: "half" }]}
                  onChange={(layout) => updateBlock(block.id, { layout: layout as "full" | "half" })}
                  variant="admin"
                />
              </div>

              <div className="grid gap-2 rounded-xl border border-line bg-black/8 p-2.5">
                <div>
                  <p className="m-0 text-xs font-extrabold text-text-secondary">Состав блока</p>
                  <p className="m-0 mt-1 text-[11px] leading-4 text-text-muted">Что именно будет отображаться внутри этого блока.</p>
                </div>

                {block.id === "hero" && (
                  <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                    {OVERVIEW_HERO_METRICS.map((item) => <StyledCheckbox key={item.key} checked={block.config.metricKeys.includes(item.key)} label={item.label} onChange={() => toggleMetric("hero", item.key)} />)}
                  </div>
                )}

                {block.id === "activity" && (
                  <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                    {OVERVIEW_ACTIVITY_METRICS.map((item) => <StyledCheckbox key={item.key} checked={block.config.metricKeys.includes(item.key)} label={item.label} onChange={() => toggleMetric("activity", item.key)} />)}
                  </div>
                )}

                {(block.id === "location-distribution" || block.id === "location-cards") && (
                  <>
                    <OverviewSelectionEditor
                      title="Какие места и объединения"
                      selection={block.config.locationSelection}
                      items={locationMetrics.map((item) => ({ key: item.key, label: item.label, count: item.count }))}
                      onModeChange={(mode) => updateSelection(block.id, "locationSelection", { mode })}
                      onToggle={(key) => toggleSelection(block.id, "locationSelection", key)}
                    />
                    {block.config.locationSelection.mode === "selected" && block.config.locationSelection.keys.length === 0 && <p className="m-0 text-xs text-amber" role="alert">Выберите хотя бы одно место или переключите режим на «Показывать все».</p>}
                    <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                      <StyledCheckbox checked={block.config.showEmpty} label="Показывать пустые места" onChange={(showEmpty) => updateConfig(block.id, { showEmpty })} />
                      <StyledCheckbox checked={block.config.showPercent} label="Показывать проценты" onChange={(showPercent) => updateConfig(block.id, { showPercent })} />
                      <StyledCheckbox checked={block.config.expandableGroups} label="Раскрывать объединения" onChange={(expandableGroups) => updateConfig(block.id, { expandableGroups })} />
                      <StyledCheckbox checked={block.config.showMemberCounts} label="Показывать состав группы" onChange={(showMemberCounts) => updateConfig(block.id, { showMemberCounts })} />
                    </div>
                  </>
                )}

                {block.id === "platoons" && (
                  <>
                    <OverviewSelectionEditor
                      title="Какие подразделения"
                      selection={block.config.platoonSelection}
                      items={platoonItems}
                      onModeChange={(mode) => updateSelection(block.id, "platoonSelection", { mode })}
                      onToggle={(key) => toggleSelection(block.id, "platoonSelection", key)}
                    />
                    {block.config.platoonSelection.mode === "selected" && block.config.platoonSelection.keys.length === 0 && <p className="m-0 text-xs text-amber" role="alert">Выберите хотя бы одно подразделение или переключите режим на «Показывать все».</p>}
                    <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                      <StyledCheckbox checked={block.config.showEmpty} label="Показывать пустые подразделения" onChange={(showEmpty) => updateConfig(block.id, { showEmpty })} />
                      <StyledCheckbox checked={block.config.showPercent} label="Показывать проценты и шкалы" onChange={(showPercent) => updateConfig(block.id, { showPercent })} />
                    </div>
                  </>
                )}

                {block.id === "recent-activity" && (
                  <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-extrabold text-text-secondary">Количество записей</span>
                      <input className={fieldClass} type="number" min={1} max={50} value={block.config.limit} onChange={(event) => updateConfig(block.id, { limit: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })} />
                    </label>
                    <StyledCheckbox checked={block.config.showRelativeTime} label="Показывать относительное время" onChange={(showRelativeTime) => updateConfig(block.id, { showRelativeTime })} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {errorMessage && <p className="mt-3 mb-0 text-xs text-red" role="alert">{errorMessage}</p>}
      {successMessage && <p className="mt-3 mb-0 text-xs text-green" role="status">{successMessage}</p>}
      <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-line bg-bg-base py-3 max-[520px]:flex-col">
        <button className={submitClass + " cursor-pointer"} type="button" disabled={saving} onClick={() => void save()}>{saving ? "Сохранение…" : "Сохранить настройки"}</button>
        <button className={fieldClass + " cursor-pointer"} type="button" disabled={saving} onClick={() => setForm(cloneDefaultOverviewSettings())}>Восстановить по умолчанию</button>
      </div>
    </div>
  );
}

export function OverviewSelectionEditor({
  title,
  selection,
  items,
  onModeChange,
  onToggle,
}: {
  title: string;
  selection: OverviewSelection;
  items: Array<{ key: string; label: string; count: number }>;
  onModeChange: (mode: "all" | "selected") => void;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-extrabold text-text-secondary">{title}</span>
      <SelectField
        ariaLabel={title}
        value={selection.mode}
        options={[{ label: "Показывать все", value: "all" }, { label: "Показывать выбранные", value: "selected" }]}
        onChange={(mode) => onModeChange(mode as "all" | "selected")}
        variant="admin"
      />
      {selection.mode === "selected" && (
        <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
          {items.length === 0 && <p className="col-span-full m-0 text-xs text-text-muted">Нет доступных элементов.</p>}
          {items.map((item) => <StyledCheckbox key={item.key} checked={selection.keys.includes(item.key)} label={item.label + " · " + item.count} onChange={() => onToggle(item.key)} />)}
        </div>
      )}
    </div>
  );
}

