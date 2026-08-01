"use client";

import { useState } from "react";
import { GearSixIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { SelectField } from "@/components/select-field";
import type { Platoon } from "../../roster/types";
import type { DutyGroupSnapshot, GroupAssignmentQuota, GroupPriorityMode } from "../types";
import { DAY_NAMES, DAY_SHORT_NAMES } from "../utils";
import { CollapsibleSection } from "./collapsible-section";
import { GROUP_NAME_MAX_LENGTH, GROUP_NOTES_MAX_LENGTH } from "./constants";
import { priorityModeOptions } from "./shared-meta";
import { StyledCheckbox } from "./styled-checkbox";

export function SettingsPanel({
  item,
  platoons,
  isBusy,
  onSave,
  onRename,
  onDelete,
}: {
  item: DutyGroupSnapshot;
  platoons: Platoon[];
  isBusy: boolean;
  onSave: (payload: {
    enabledPlatoons: string[];
    peoplePerDay: number;
    assignmentQuotas: GroupAssignmentQuota[];
    autoRotate: boolean;
    activeDays: number[];
    priorityMode: GroupPriorityMode;
  }) => Promise<unknown>;
  onRename: (payload: { name: string; notes: string }) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.group.name);
  const [notes, setNotes] = useState(item.group.notes);
  const [nameTouched, setNameTouched] = useState(false);
  const [peoplePerDay, setPeoplePerDay] = useState(item.rule.peoplePerDay);
  const [assignmentQuotas, setAssignmentQuotas] = useState<GroupAssignmentQuota[]>(item.rule.assignmentQuotas);
  const [enabledPlatoons, setEnabledPlatoons] = useState(item.rule.enabledPlatoons);
  const [autoRotate, setAutoRotate] = useState(item.rule.autoRotate);
  const [activeDays, setActiveDays] = useState(item.rule.activeDays);
  const [priorityMode, setPriorityMode] = useState<GroupPriorityMode>(
    item.rule.priorityMode,
  );

  const togglePlatoon = (id: string) =>
    setEnabledPlatoons((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  const toggleDay = (day: number) =>
    setActiveDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [deleteRequested, setDeleteRequested] = useState(false);
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const nameError = nameTouched && !name.trim() ? "Введите название группы." : null;

  return (
    <aside
      className="grid min-w-0 gap-0 rounded-[16px] border border-line bg-bg-panel/70 p-3 lg:col-span-2 xl:col-span-1"
      aria-label="Настройки группы"
    >
      <div className="flex items-center gap-2 pb-2.5 text-[13px] font-bold text-text-secondary">
        <GearSixIcon size={18} /> Настройки
      </div>

      <CollapsibleSection
        title="Описание"
        open={!!openSections["desc"]}
        onToggle={() => toggleSection("desc")}
      >
        <label className="grid min-w-0 gap-1.75">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Название
          </span>
          <input
            className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-base text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setNameTouched(true)}
            maxLength={GROUP_NAME_MAX_LENGTH}
            required
            aria-invalid={nameError ? true : undefined}
            aria-describedby="group-settings-name-hint"
          />
          <small
            id="group-settings-name-hint"
            className={nameError ? "text-xs text-red" : "text-[11px] text-text-muted"}
          >
            {nameError ?? `До ${GROUP_NAME_MAX_LENGTH} символов.`}
          </small>
        </label>
        <label className="grid min-w-0 gap-1.75">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Заметка
          </span>
          <textarea
            className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-base text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={GROUP_NOTES_MAX_LENGTH}
          />
        </label>
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-3.25 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          disabled={isBusy || !name.trim()}
          onClick={() => onRename({ name: name.trim(), notes })}
        >
          Сохранить описание
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        title="Правила"
        open={!!openSections["rules"]}
        onToggle={() => toggleSection("rules")}
      >
        <div className="grid min-w-0 gap-1.75">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Сколько человек назначать в день
          </span>
          <div className="grid grid-cols-[38px_1fr_38px] overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-text-primary disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() => setPeoplePerDay((value) => Math.max(1, value - 1))}
              disabled={isBusy || assignmentQuotas.length > 0 || peoplePerDay <= 1}
              aria-label="Уменьшить количество людей в день"
            >
              -
            </button>
            <strong className="grid place-items-center border-x border-line font-mono">
              {assignmentQuotas.length > 0 ? assignmentQuotas.reduce((total, quota) => total + quota.count, 0) : peoplePerDay}
            </strong>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-text-primary disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() =>
                setPeoplePerDay((value) => Math.min(40, value + 1))
              }
              disabled={isBusy || assignmentQuotas.length > 0 || peoplePerDay >= 40}
              aria-label="Увеличить количество людей в день"
            >
              +
            </button>
          </div>
        </div>
        <StyledCheckbox
          checked={autoRotate}
          label="Автоматически заполнять дни"
          onChange={setAutoRotate}
        />
        <div className="grid min-w-0 gap-1.75">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Кого назначать автоматически
          </span>
          <SelectField
            ariaLabel="Кого назначать автоматически"
            value={priorityMode}
            options={priorityModeOptions}
            onChange={(value) => setPriorityMode(value as GroupPriorityMode)}
          />
          <small className="text-[11px] text-text-muted">
            {priorityMode === "random"
              ? "Случайный режим не смотрит на историю назначений, но учитывает исключения и сначала избегает конфликтов."
              : "Режим по очереди выбирает тех, кого давно не назначали."}
          </small>
        </div>
        <div className="grid min-w-0 gap-1.75">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Дни работы группы
          </span>
          <div className="flex flex-wrap gap-1.75">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <StyledCheckbox
                key={day}
                checked={activeDays.includes(day)}
                label={DAY_SHORT_NAMES[day]}
                title={DAY_NAMES[day]}
                compact
                onChange={() => toggleDay(day)}
              />
            ))}
          </div>
        </div>
        <div className="grid min-w-0 gap-1.75">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
              Точные квоты по подразделениям
            </span>
            <span className="shrink-0 rounded-full border border-accent-line bg-accent-soft px-2 py-1 text-[11px] font-bold text-text-primary">
              {assignmentQuotas.reduce((total, quota) => total + quota.count, 0)} чел.
            </span>
          </div>
          <small className="text-[11px] text-text-muted">
            Каждая строка задаёт точное количество людей из выбранного подразделения.
          </small>
          {assignmentQuotas.length > 0 && (
            <div className="grid gap-2">
              {assignmentQuotas.map((quota) => (
                <div key={quota.platoonId} className="grid grid-cols-[minmax(0,1fr)_84px_36px] items-center gap-1.5">
                  <SelectField
                    ariaLabel="Подразделение квоты"
                    value={quota.platoonId}
                    options={platoons.filter((platoon) =>
                      !assignmentQuotas.some((item) => item.platoonId !== quota.platoonId && item.platoonId === platoon.id),
                    ).map((platoon) => ({ value: platoon.id, label: platoon.label }))}
                    onChange={(value) => setAssignmentQuotas((current) => current.map((item) =>
                      item.platoonId === quota.platoonId ? { ...item, platoonId: value } : item,
                    ))}
                  />
                  <div className="grid grid-cols-[24px_1fr_24px] overflow-hidden rounded-xl border border-line">
                    <button
                      type="button"
                      className="cursor-pointer border-0 bg-transparent text-text-primary disabled:cursor-not-allowed disabled:opacity-55"
                      onClick={() => setAssignmentQuotas((current) => current.map((item) =>
                        item.platoonId === quota.platoonId ? { ...item, count: Math.max(1, item.count - 1) } : item,
                      ))}
                      disabled={isBusy || quota.count <= 1}
                      aria-label="Уменьшить квоту"
                    >
                      −
                    </button>
                    <strong className="grid place-items-center border-x border-line font-mono">{quota.count}</strong>
                    <button
                      type="button"
                      className="cursor-pointer border-0 bg-transparent text-text-primary disabled:cursor-not-allowed disabled:opacity-55"
                      onClick={() => setAssignmentQuotas((current) => current.map((item) =>
                        item.platoonId === quota.platoonId ? { ...item, count: Math.min(40, item.count + 1) } : item,
                      ))}
                      disabled={isBusy || quota.count >= 40}
                      aria-label="Увеличить квоту"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="grid size-9.5 place-items-center rounded-xl border border-line bg-transparent text-text-muted transition-colors hover:border-red hover:text-red"
                    onClick={() => setAssignmentQuotas((current) => {
                      const next = current.filter((item) => item.platoonId !== quota.platoonId);
                      // Back to free count mode: keep peoplePerDay in stepper bounds (1–40).
                      if (next.length === 0) {
                        setPeoplePerDay((value) => Math.min(40, Math.max(1, value)));
                      }
                      return next;
                    })}
                    disabled={isBusy}
                    aria-label="Удалить квоту"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="inline-flex min-h-9.5 items-center justify-center gap-1.5 rounded-xl border border-line bg-transparent px-3 text-xs font-extrabold text-text-secondary transition-colors hover:border-accent-line hover:text-text-primary"
            disabled={isBusy || assignmentQuotas.length >= platoons.length}
            onClick={() => {
              const nextPlatoon = platoons.find((platoon) => !assignmentQuotas.some((quota) => quota.platoonId === platoon.id));
              if (nextPlatoon) setAssignmentQuotas((current) => [...current, { platoonId: nextPlatoon.id, count: 1 }]);
            }}
          >
            <PlusIcon size={15} /> Добавить подразделение
          </button>
          {assignmentQuotas.length === 0 && (
            <small className="text-[11px] text-text-muted">
              Если квоты не заданы, действует общее количество и фильтр подразделений ниже.
            </small>
          )}
          {assignmentQuotas.length === 0 && (
            <div className="grid min-w-0 gap-1.75">
              <span className="text-[11px] font-bold text-text-secondary">
                Ограничить ротацию подразделениями
              </span>
              <div className="flex flex-wrap gap-1.75">
                {platoons.map((platoon) => (
                  <StyledCheckbox
                    key={platoon.id}
                    checked={enabledPlatoons.includes(platoon.id)}
                    label={platoon.label}
                    compact
                    onChange={() => togglePlatoon(platoon.id)}
                  />
                ))}
              </div>
              {enabledPlatoons.length === 0 && (
                <small className="text-[11px] text-text-muted">Берём людей из всех подразделений.</small>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          disabled={isBusy}
          onClick={() =>
            onSave({
              enabledPlatoons: assignmentQuotas.length > 0 ? assignmentQuotas.map((quota) => quota.platoonId) : enabledPlatoons,
              peoplePerDay: assignmentQuotas.length > 0 ? assignmentQuotas.reduce((total, quota) => total + quota.count, 0) : peoplePerDay,
              assignmentQuotas,
              autoRotate,
              activeDays,
              priorityMode,
            })
          }
        >
          Сохранить правила
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        title="Опасная зона"
        open={!!openSections["danger"]}
        onToggle={() => toggleSection("danger")}
      >
        {deleteRequested ? (
          <div
            className="grid gap-2.5 rounded-[12px] border border-[oklch(69%_0.18_28/0.35)] bg-[oklch(69%_0.18_28/0.1)] p-2.5"
            role="alert"
          >
            <div className="grid min-w-0 gap-1">
              <strong className="text-sm text-text-primary">Удалить группу?</strong>
              <span className="wrap-anywhere text-xs text-text-secondary">
                Группа «{item.group.name}» и её назначения будут удалены без возможности отмены.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="inline-flex min-h-9.5 min-w-0 items-center justify-center rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2 text-center text-xs font-extrabold text-text-primary transition-[background,border-color] duration-200 hover:border-line-strong hover:bg-[oklch(100%_0_0/0.08)]"
                disabled={isBusy}
                onClick={() => setDeleteRequested(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="inline-flex min-h-9.5 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[oklch(69%_0.18_28/0.45)] bg-[oklch(69%_0.18_28/0.16)] px-2 text-center text-xs font-extrabold text-red transition-[background,border-color] duration-200 hover:border-red hover:bg-[oklch(69%_0.18_28/0.22)]"
                disabled={isBusy}
                onClick={onDelete}
              >
                <TrashIcon size={15} /> Удалить
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-[oklch(69%_0.18_28/0.35)] bg-[oklch(69%_0.18_28/0.12)] px-3.25 text-center text-[13px] font-extrabold text-red transition-[background,border-color,transform] duration-200 hover:border-[oklch(69%_0.18_28/0.55)] hover:bg-[oklch(69%_0.18_28/0.18)] cursor-pointer active:translate-y-px"
            disabled={isBusy}
            onClick={() => setDeleteRequested(true)}
          >
            <TrashIcon size={16} /> Удалить группу
          </button>
        )}
      </CollapsibleSection>
    </aside>
  );
}

