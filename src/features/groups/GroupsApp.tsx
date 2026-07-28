"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BroomIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CheckIcon,
  ClipboardTextIcon,
  ForkKnifeIcon,
  GearSixIcon,
  MapPinAreaIcon,
  PlusIcon,
  ShieldWarningIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersThreeIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import { DisclosureContent } from "@/components/disclosure-content";
import { SelectField } from "../../components/select-field";
import {
  SearchSortControl,
  type SearchSortOption,
} from "@/components/search-sort-control";
import type { Platoon, Person } from "../roster/types";
import { abbreviateName, conscriptionLabel, cx, getInitials } from "../roster/utils";
import type {
  DutyGroupSnapshot,
  GroupConflict,
  GroupPriorityMode,
  GroupsSnapshot,
  GroupTemplate,
} from "./types";
import {
  DAY_NAMES,
  DAY_SHORT_NAMES,
  colorTokenClass,
  formatDateLabel,
  formatDayLabel,
} from "./utils";
import {
  filterListItems,
  sortListItems,
  type ListSortState,
} from "@/components/list-utils";
import {
  GroupApiError,
  assignGroupPerson,
  createGroup,
  deleteGroup,
  excludeGroupPerson,
  fetchGroupsSnapshot,
  includeGroupPerson,
  removeGroupAssignment,
  rotateGroup,
  updateGroup,
  updateRule,
} from "./api";

type GroupsAppProps = {
  initialSnapshot: GroupsSnapshot;
  canWrite?: boolean;
};

type PendingConflict = {
  personId: string;
  conflicts: GroupConflict[];
} | null;

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = ref.current;
    window.setTimeout(
      () => panel?.querySelector<HTMLElement>(focusableSelector)?.focus(),
      0,
    );

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  return ref;
}

const iconMap = {
  Broom: BroomIcon,
  ForkKnife: ForkKnifeIcon,
  MapPinArea: MapPinAreaIcon,
  ClipboardText: ClipboardTextIcon,
};

const priorityModeOptions: Array<{ label: string; value: GroupPriorityMode }> =
  [
    { value: "oldest", label: "По очереди" },
    { value: "random", label: "Случайно" },
  ];

const priorityModeLabels: Record<GroupPriorityMode, string> = {
  oldest: "по очереди",
  random: "случайно",
};

const groupSortOptions: SearchSortOption[] = [
  { key: "alpha", label: "А–Я" },
];

export function GroupsApp({
  initialSnapshot,
  canWrite = true,
}: GroupsAppProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeGroupId, setActiveGroupId] = useState(
    initialSnapshot.groups[0]?.id ?? null,
  );
  const [selectedDate, setSelectedDate] = useState(
    initialSnapshot.weekDates[0] ?? "",
  );
  const [isBusy, setBusy] = useState(false);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isAssignOpen, setAssignOpen] = useState(false);
  const [isExcludeOpen, setExcludeOpen] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict>(null);
  const [platoons, setPlatoons] = useState<Platoon[]>(initialSnapshot.platoons);
  const [error, setError] = useState<string | null>(null);
  const [groupQuery, setGroupQuery] = useState("");
  const [groupSort, setGroupSort] = useState<ListSortState>({
    key: "alpha",
    direction: "asc",
  });
  const [assignmentQuery, setAssignmentQuery] = useState("");
  const [assignmentSort, setAssignmentSort] = useState<ListSortState>({
    key: "alpha",
    direction: "asc",
  });

  const activeSnapshot = activeGroupId
    ? (snapshot.groupSnapshots[activeGroupId] ?? null)
    : null;
  const selectedDay =
    activeSnapshot?.week.find((day) => day.date === selectedDate) ??
    activeSnapshot?.week[0] ??
    null;
  const selectedAvailablePeople =
    activeSnapshot?.availablePeopleByDate[selectedDate] ??
    activeSnapshot?.availablePeople ??
    [];
  const totalConflicts = Object.values(snapshot.groupSnapshots).reduce(
    (sum, group) => sum + group.stats.conflictsToday,
    0,
  );
  const assignedToday = Object.values(snapshot.groupSnapshots).reduce(
    (sum, group) => sum + group.stats.assignedToday,
    0,
  );
  const weekAssignments = Object.values(snapshot.groupSnapshots).reduce(
    (sum, group) => sum + group.stats.weekAssignments,
    0,
  );
  const visibleGroups = useMemo(
    () =>
      sortListItems(
        filterListItems(
          snapshot.groups,
          groupQuery,
          (group) => `${group.name} ${group.notes}`,
        ),
        groupSort,
        {
          label: (group) => group.name,
          defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
        },
      ),
    [groupQuery, groupSort, snapshot.groups],
  );
  const visibleAssignments = useMemo(() => {
    const assignments = selectedDay?.assignments ?? [];
    return sortListItems(
      filterListItems(
        assignments,
        assignmentQuery,
        (assignment) =>
          `${assignment.personName ?? assignment.personId} ${assignment.personRank ?? ""} ${assignment.personConscriptionNumber ?? ""}`,
      ),
      assignmentSort,
      {
        label: (assignment) => assignment.personName ?? assignment.personId,
        rank: (assignment) => assignment.personRank ?? "",
        defaultCompare: (a, b) => a.createdAt - b.createdAt,
      },
    );
  }, [assignmentQuery, assignmentSort, selectedDay]);

  const applySnapshot = useCallback((next: GroupsSnapshot) => {
    setSnapshot(next);
    setPlatoons(next.platoons);
    setActiveGroupId((current) =>
      current && next.groupSnapshots[current]
        ? current
        : (next.groups[0]?.id ?? null),
    );
    setSelectedDate((current) =>
      next.weekDates.includes(current) ? current : (next.weekDates[0] ?? ""),
    );
  }, []);

  const refresh = useCallback(async () => {
    try {
      applySnapshot(await fetchGroupsSnapshot());
    } catch {
      setError("Не удалось обновить группы");
    }
  }, [applySnapshot]);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("roster", () => refresh());
    return () => source.close();
  }, [refresh]);

  async function run(
    action: () => Promise<GroupsSnapshot>,
    message = "Операция не выполнена",
  ) {
    if (!canWrite) return null;
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      applySnapshot(next);
      return next;
    } catch {
      setError(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function assignPerson(personId: string, allowConflict = false) {
    if (!canWrite) return;
    if (!activeGroupId || !selectedDate) return;
    setBusy(true);
    setError(null);
    try {
      applySnapshot(
        await assignGroupPerson(
          activeGroupId,
          personId,
          selectedDate,
          allowConflict,
        ),
      );
      setAssignOpen(false);
      setPendingConflict(null);
    } catch (err) {
      if (err instanceof GroupApiError && err.status === 409) {
        setPendingConflict({ personId, conflicts: err.conflicts });
      } else {
        setError("Назначение не выполнено");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="grid min-w-0 max-w-full gap-4 p-3 text-text-primary md:p-4.5"
      aria-busy={isBusy}
    >
      <header className="grid min-w-0 items-end gap-4.5 rounded-[22px] border border-line bg-[linear-gradient(135deg,oklch(22%_0.05_286/0.9),oklch(16%_0.035_286/0.82))] p-4.5 shadow-(--shadow) lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-bold text-text-secondary">
            <UsersThreeIcon size={16} weight="duotone" /> Группы
          </div>
          <h1 className="mt-2 mb-1.5 max-w-full wrap-anywhere text-[clamp(28px,4vw,42px)] font-bold leading-[1.02] tracking-[-0.04em]">
            Наряды и повторяемые назначения
          </h1>
          <p className="m-0 max-w-[68ch] wrap-anywhere text-sm leading-normal text-text-secondary">
            Сегодня, неделя, правила ротации, исключения и ручные замены в одном
            рабочем экране.
          </p>
        </div>
        <div
          className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Сводка групп"
        >
          <SummaryCard label="Сегодня" value={assignedToday} hint="назначено" />
          <SummaryCard
            label="Неделя"
            value={weekAssignments}
            hint="назначений"
          />
          <SummaryCard
            label="Конфликты"
            value={totalConflicts}
            hint="проверить"
            tone={totalConflicts > 0 ? "warn" : "ok"}
          />
        </div>
      </header>

      {error && (
        <div
          className="flex min-w-0 items-center gap-2 wrap-anywhere rounded-[14px] border border-[oklch(78%_0.16_74/0.35)] bg-[oklch(78%_0.16_74/0.1)] px-3 py-2.5 text-[13px] text-amber"
          role="alert"
        >
          <WarningIcon size={18} />
          {error}
        </div>
      )}
      {!canWrite && (
        <div
          className="flex min-w-0 items-center gap-2 wrap-anywhere rounded-[14px] border border-[oklch(78%_0.16_74/0.35)] bg-[oklch(78%_0.16_74/0.1)] px-3 py-2.5 text-[13px] text-amber"
          role="status"
        >
          Доступ только для просмотра.
        </div>
      )}

      <div className="grid min-w-0 items-start gap-3.5 lg:grid-cols-[minmax(210px,250px)_minmax(0,1fr)] xl:grid-cols-[minmax(210px,250px)_minmax(0,1fr)_minmax(260px,310px)]">
        <aside
          className="grid min-w-0 gap-3 rounded-[20px] border border-line bg-bg-panel p-3 shadow-(--shadow)"
          aria-label="Список групп"
        >
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-text-secondary">
            <span>Активные группы</span>
            {canWrite && (
              <button
                type="button"
                className="inline-flex h-8.5 min-h-8.5 w-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.04)] p-0 text-text-secondary transition-[background,border-color,transform] duration-200 hover:bg-[oklch(100%_0_0/0.08)] hover:text-text-primary cursor-pointer active:translate-y-px"
                onClick={() => setCreateOpen(true)}
                aria-label="Создать группу"
              >
                <PlusIcon size={18} />
              </button>
            )}
          </div>
          <SearchSortControl
            query={groupQuery}
            onQueryChange={setGroupQuery}
            sort={groupSort}
            onSortChange={setGroupSort}
            options={groupSortOptions}
            showSort={false}
            placeholder="Найти группу"
            ariaLabel="Поиск групп"
          />
          <div className="grid gap-2">
            {visibleGroups.length === 0 ? (
              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                Группы не найдены.
              </p>
            ) : (
              visibleGroups.map((group) => {
                const item = snapshot.groupSnapshots[group.id];
                const Icon =
                  iconMap[item?.template.icon as keyof typeof iconMap] ??
                  ClipboardTextIcon;
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl border border-(--tone-line) bg-[oklch(100%_0_0/0.035)] p-2.5 text-left text-text-primary transition-[border-color,background,transform] duration-200 hover:border-accent-line hover:bg-[oklch(100%_0_0/0.065)] cursor-pointer active:translate-y-px ${activeGroupId === group.id ? "border-(--tone-line) bg-(--tone-soft)" : ""} ${colorTokenClass(item?.template.colorToken ?? "neutral")}`}
                    onClick={() => setActiveGroupId(group.id)}
                  >
                    <span className="grid h-9.5 w-9.5 flex-none place-items-center rounded-[14px] bg-(--tone-soft) text-(--tone)">
                      <Icon size={20} weight="duotone" />
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                        {group.name}
                      </strong>
                      <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                        {item?.stats.assignedToday ?? 0} сегодня,{" "}
                        {item?.stats.availableToday ?? 0} доступно
                      </small>
                    </span>
                    {item && item.stats.conflictsToday > 0 && (
                      <span className="min-w-6 overflow-hidden rounded-full bg-[oklch(78%_0.16_74/0.16)] px-1.75 py-0.75 text-center font-mono text-xs font-extrabold text-amber">
                        {item.stats.conflictsToday}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="grid min-w-0 gap-3 rounded-[20px] border border-line bg-bg-panel p-3 shadow-(--shadow)">
          {activeSnapshot && selectedDay ? (
            <>
              <GroupToolbar
                item={activeSnapshot}
                selectedDate={selectedDate}
                onRotate={() =>
                  run(
                    () => rotateGroup(activeSnapshot.group.id, selectedDate),
                    "Ротация не выполнена",
                  )
                }
                onAssign={() => setAssignOpen(true)}
                onToggle={() =>
                  run(() =>
                    updateGroup({
                      id: activeSnapshot.group.id,
                      enabled: !activeSnapshot.group.enabled,
                    }),
                  )
                }
                disabled={isBusy || !canWrite}
              />
              <WeekStrip
                item={activeSnapshot}
                selectedDate={selectedDate}
                onSelect={setSelectedDate}
              />
              <section className="grid gap-3 rounded-[18px] border border-line bg-[oklch(100%_0_0/0.03)] p-3">
                <div className="grid min-w-0 gap-2.5 min-[560px]:flex min-[560px]:items-center min-[560px]:justify-between">
                  <div className="min-w-0">
                    <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tracking-[-0.02em]">
                      {formatDateLabel(selectedDate)} ·{" "}
                      {DAY_NAMES[selectedDay.dayOfWeek]}
                    </h2>
                    <p className="m-0 mt-0.75 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                      {selectedDay.isActive
                        ? "Группа работает по расписанию"
                        : "День выключен в правилах группы"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.5 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
                    onClick={() => setExcludeOpen(true)}
                    disabled={isBusy || !canWrite}
                  >
                    <UserMinusIcon size={17} /> Исключения
                  </button>
                </div>

                <SearchSortControl
                  query={assignmentQuery}
                  onQueryChange={setAssignmentQuery}
                  sort={assignmentSort}
                  onSortChange={setAssignmentSort}
                  placeholder="Найти назначенного"
                  ariaLabel="Поиск и сортировка назначений"
                />

                {selectedDay.assignments.length === 0 ? (
                  <EmptyState
                    title="Назначений нет"
                    text="Включите день в правилах, запустите ротацию или назначьте человека вручную."
                  />
                ) : visibleAssignments.length === 0 ? (
                  <EmptyState
                    title="Ничего не найдено"
                    text="Измените поиск или сортировку назначений."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
                    {visibleAssignments.map((assignment) => (
                      <article
                        key={assignment.id}
                        className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-2xl border ${assignment.conflicts.length > 0 ? "border-[oklch(78%_0.16_74/0.45)]" : "border-line"} bg-[oklch(100%_0_0/0.04)] p-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]`}
                      >
                        <div className="grid h-9.5 w-9.5 flex-none place-items-center rounded-full bg-accent-soft text-xs font-extrabold text-accent">
                          {assignment.personName
                            ? getInitials(assignment.personName)
                            : "?"}
                        </div>
                        <div className="grid min-w-0 gap-0.5">
                          <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                            {assignment.personName
                              ? abbreviateName(assignment.personName)
                              : assignment.personId}
                          </strong>
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                            {assignment.personRank ?? "Без звания"}
                          </span>
                          {assignment.personConscriptionNumber && (
                            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                              {conscriptionLabel(assignment.personConscriptionNumber)}
                            </span>
                          )}
                          {assignment.conflicts.length > 0 && (
                            <em className="flex min-w-0 items-center gap-1.25 overflow-hidden text-ellipsis whitespace-nowrap text-xs not-italic text-amber">
                              <ShieldWarningIcon size={15} /> Уже есть в:{" "}
                              {assignment.conflicts
                                .map((item) => item.groupName)
                                .join(", ")}
                            </em>
                          )}
                        </div>
                        <div className="col-span-full flex items-center justify-between gap-2.5 sm:col-auto sm:justify-normal">
                          <span
                            className={`inline-block max-w-27.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-extrabold ${assignment.source === "manual" ? "border-[oklch(72%_0.15_242/0.4)] text-blue" : "border-[oklch(76%_0.17_151/0.34)] text-green"}`}
                          >
                            {assignment.source === "manual"
                              ? "Вручную"
                              : "Авто"}
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-8.5 min-h-8.5 w-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.04)] p-0 text-text-secondary transition-[background,border-color,transform] duration-200 hover:border-[oklch(69%_0.18_28/0.45)] hover:text-red cursor-pointer active:translate-y-px"
                            onClick={() =>
                              run(
                                () => removeGroupAssignment(assignment.id),
                                "Не удалось снять назначение",
                              )
                            }
                            disabled={isBusy || !canWrite}
                            aria-label="Снять назначение"
                          >
                            <XIcon size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <EmptyState
              title="Группы не созданы"
              text="Создайте первую группу из шаблона, чтобы включить ротацию."
            />
          )}
        </main>

        {activeSnapshot && canWrite && (
          <SettingsPanel
            key={`${activeSnapshot.group.id}:${activeSnapshot.group.updatedAt}:${activeSnapshot.rule.peoplePerDay}:${activeSnapshot.rule.autoRotate}:${activeSnapshot.rule.activeDays.join("-")}:${activeSnapshot.rule.enabledPlatoons.join("-")}:${activeSnapshot.rule.priorityMode}`}
            item={activeSnapshot}
            platoons={platoons}
            isBusy={isBusy}
            onSave={(payload) =>
              run(
                () =>
                  updateRule({ groupId: activeSnapshot.group.id, ...payload }),
                "Правила не сохранены",
              )
            }
            onRename={(payload) =>
              run(
                () => updateGroup({ id: activeSnapshot.group.id, ...payload }),
                "Группа не сохранена",
              )
            }
            onDelete={() => {
              if (!window.confirm("Удалить группу и все её назначения?")) {
                return Promise.resolve(null);
              }
              return run(
                () => deleteGroup(activeSnapshot.group.id),
                "Группа не удалена",
              );
            }}
          />
        )}
      </div>

      {isCreateOpen && canWrite && (
        <CreateGroupPanel
          templates={snapshot.templates}
          isBusy={isBusy}
          onClose={() => setCreateOpen(false)}
          onCreate={(payload) =>
            run(() => createGroup(payload), "Группа не создана").then(
              (next) => {
                if (next) {
                  const newest = [...next.groups].sort(
                    (a, b) => b.createdAt - a.createdAt,
                  )[0];
                  setActiveGroupId(newest?.id ?? null);
                  setCreateOpen(false);
                }
              },
            )
          }
        />
      )}

      {isAssignOpen && activeSnapshot && canWrite && (
        <PersonPickerPanel
          title="Назначить вручную"
          people={selectedAvailablePeople}
          onClose={() => {
            setAssignOpen(false);
            setPendingConflict(null);
          }}
          onPick={(personId) => assignPerson(personId)}
          pendingConflict={pendingConflict}
          onConfirmConflict={() =>
            pendingConflict
              ? assignPerson(pendingConflict.personId, true)
              : undefined
          }
          isBusy={isBusy}
        />
      )}

      {isExcludeOpen && activeSnapshot && canWrite && (
        <ExclusionsPanel
          item={activeSnapshot}
          isBusy={isBusy}
          onClose={() => setExcludeOpen(false)}
          onExclude={(personId, dayOfWeek, reason) =>
            run(
              () =>
                excludeGroupPerson(
                  activeSnapshot.group.id,
                  personId,
                  dayOfWeek,
                  reason,
                ),
              "Исключение не добавлено",
            )
          }
          onInclude={(exclusionId) =>
            run(() => includeGroupPerson(exclusionId), "Исключение не снято")
          }
        />
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-[oklch(100%_0_0/0.045)] p-3">
      <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold text-text-muted">
        {label}
      </span>
      <strong
        className={`my-0.5 block overflow-hidden text-ellipsis font-mono text-2xl leading-none ${tone === "ok" ? "text-green" : tone === "warn" ? "text-amber" : "text-text-primary"}`}
      >
        {value}
      </strong>
      <small className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold text-text-muted">
        {hint}
      </small>
    </div>
  );
}

function GroupToolbar({
  item,
  selectedDate,
  onRotate,
  onAssign,
  onToggle,
  disabled,
}: {
  item: DutyGroupSnapshot;
  selectedDate: string;
  onRotate: () => void;
  onAssign: () => void;
  onToggle: () => void;
  disabled: boolean;
}) {
  const Icon =
    iconMap[item.template.icon as keyof typeof iconMap] ?? ClipboardTextIcon;
  return (
    <div
      className={`grid min-w-0 items-center gap-3 rounded-[18px] border border-(--tone-line) bg-[linear-gradient(135deg,var(--tone-soft),oklch(100%_0_0/0.035))] p-3 min-[1800px]:grid-cols-[minmax(0,1fr)_auto] ${colorTokenClass(item.template.colorToken)}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9.5 w-9.5 flex-none place-items-center rounded-[14px] bg-(--tone-soft) text-(--tone)">
          <Icon size={24} weight="duotone" />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tracking-[-0.02em]">
            {item.group.name}
          </h2>
          <p className="m-0 mt-0.75 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
            {item.group.notes || item.template.name} · {item.rule.peoplePerDay}{" "}
            чел. в день · {priorityModeLabels[item.rule.priorityMode]} ·{" "}
            {item.candidatePlatoons.length} подразделений
          </p>
        </div>
      </div>
      <div className="grid min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-3.25 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          onClick={onToggle}
          disabled={disabled}
        >
          {item.group.enabled ? "Выключить" : "Включить"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-3.25 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          onClick={onRotate}
          disabled={disabled}
        >
          <CalendarBlankIcon size={17} /> Ротация{" "}
          {formatDateLabel(selectedDate)}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          onClick={onAssign}
          disabled={disabled}
        >
          <UserPlusIcon size={17} /> Назначить
        </button>
      </div>
    </div>
  );
}

function WeekStrip({
  item,
  selectedDate,
  onSelect,
}: {
  item: DutyGroupSnapshot;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
      aria-label="План на неделю"
    >
      {item.week.map((day) => (
        <button
          key={day.date}
          type="button"
          className={`relative grid min-w-0 gap-0.5 rounded-[14px] border p-2.5 text-left text-text-primary transition-[border-color,background,transform] duration-200 hover:border-accent-line hover:bg-[oklch(100%_0_0/0.065)] cursor-pointer active:translate-y-px ${selectedDate === day.date ? "border-accent-line bg-accent-soft" : "border-line bg-[oklch(100%_0_0/0.035)]"} ${!day.isActive ? "opacity-[0.62]" : ""}`}
          onClick={() => onSelect(day.date)}
        >
          <span className="text-[11px] font-bold text-text-muted">
            {formatDayLabel(day.dayOfWeek)}
          </span>
          <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
            {formatDateLabel(day.date)}
          </strong>
          <small className="text-[11px] font-bold text-text-muted">
            {day.assignments.length}/{item.rule.peoplePerDay}
          </small>
          {day.conflictsCount > 0 && (
            <em className="absolute right-1.5 top-1.5 min-w-4.5 rounded-full bg-amber text-center font-mono text-[10px] font-black not-italic text-[oklch(15%_0.035_286)]">
              {day.conflictsCount}
            </em>
          )}
        </button>
      ))}
    </div>
  );
}

function SettingsPanel({
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
    autoRotate: boolean;
    activeDays: number[];
    priorityMode: GroupPriorityMode;
  }) => Promise<unknown>;
  onRename: (payload: { name: string; notes: string }) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [name, setName] = useState(item.group.name);
  const [notes, setNotes] = useState(item.group.notes);
  const [peoplePerDay, setPeoplePerDay] = useState(item.rule.peoplePerDay);
  const [autoRotate, setAutoRotate] = useState(item.rule.autoRotate);
  const [activeDays, setActiveDays] = useState(item.rule.activeDays);
  const [enabledPlatoons, setEnabledPlatoons] = useState(
    item.rule.enabledPlatoons,
  );
  const [priorityMode, setPriorityMode] = useState<GroupPriorityMode>(
    item.rule.priorityMode,
  );

  const toggleDay = (day: number) =>
    setActiveDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );
  const togglePlatoon = (id: string) =>
    setEnabledPlatoons((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside
      className="grid min-w-0 gap-3 rounded-[20px] border border-line bg-bg-panel p-3 shadow-(--shadow) lg:col-span-2 xl:col-span-1"
      aria-label="Настройки группы"
    >
      <div className="flex items-center gap-2 text-[13px] font-bold text-text-secondary">
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
            className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="grid min-w-0 gap-1.75">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Заметка
          </span>
          <textarea
            className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
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
            Людей в день
          </span>
          <div className="grid grid-cols-[38px_1fr_38px] overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-text-primary"
              onClick={() => setPeoplePerDay((value) => Math.max(1, value - 1))}
            >
              -
            </button>
            <strong className="grid place-items-center border-x border-line font-mono">
              {peoplePerDay}
            </strong>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-text-primary"
              onClick={() =>
                setPeoplePerDay((value) => Math.min(40, value + 1))
              }
            >
              +
            </button>
          </div>
        </div>
        <StyledCheckbox
          checked={autoRotate}
          label="Авто-ротация"
          onChange={setAutoRotate}
        />
        <div className="grid min-w-0 gap-1.75">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Способ автоназначения
          </span>
          <SelectField
            ariaLabel="Способ автоназначения"
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
            Активные дни
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
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Кандидаты из подразделений
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
            <small className="text-[11px] text-text-muted">
              Пусто значит все подразделения.
            </small>
          )}
        </div>
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          disabled={isBusy}
          onClick={() =>
            onSave({
              enabledPlatoons,
              peoplePerDay,
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
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-[oklch(69%_0.18_28/0.35)] bg-[oklch(69%_0.18_28/0.12)] px-3.25 text-center text-[13px] font-extrabold text-red transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          disabled={isBusy}
          onClick={onDelete}
        >
          <TrashIcon size={16} /> Удалить группу
        </button>
      </CollapsibleSection>
    </aside>
  );
}

function CreateGroupPanel({
  templates,
  isBusy,
  onClose,
  onCreate,
}: {
  templates: GroupTemplate[];
  isBusy: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    templateId: string;
    notes: string;
  }) => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const selected = templates.find((item) => item.id === templateId);
  const [name, setName] = useState(selected?.name ?? "");
  const [notes, setNotes] = useState("");

  return (
    <Drawer title="Новая группа" onClose={onClose}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {templates.map((template) => {
          const Icon =
            iconMap[template.icon as keyof typeof iconMap] ?? ClipboardTextIcon;
          return (
            <button
              key={template.id}
              type="button"
              className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-2xl border border-(--tone-line) bg-[oklch(100%_0_0/0.035)] p-2.5 text-left text-text-primary transition-[border-color,background,transform] duration-200 hover:border-accent-line hover:bg-[oklch(100%_0_0/0.065)] cursor-pointer active:translate-y-px ${templateId === template.id ? "border-(--tone-line) bg-(--tone-soft)" : ""} ${colorTokenClass(template.colorToken)}`}
              onClick={() => {
                setTemplateId(template.id);
                setName(template.name);
              }}
              disabled={isBusy}
            >
              <Icon size={22} weight="duotone" />
              <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                {template.name}
              </strong>
              <small className="col-start-2 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-text-muted">
                {template.defaultPeoplePerDay} чел.
              </small>
            </button>
          );
        })}
      </div>
      <label className="grid min-w-0 gap-1.75">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
          Название
        </span>
        <input
          className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="grid min-w-0 gap-1.75">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
          Заметка
        </span>
        <textarea
          className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
        disabled={isBusy || !name.trim() || !templateId}
        onClick={() => onCreate({ name: name.trim(), templateId, notes })}
      >
        Создать
      </button>
    </Drawer>
  );
}

function PersonPickerPanel({
  title,
  people,
  pendingConflict,
  isBusy,
  onClose,
  onPick,
  onConfirmConflict,
}: {
  title: string;
  people: Person[];
  pendingConflict: PendingConflict;
  onClose: () => void;
  onPick: (personId: string) => void;
  onConfirmConflict: () => void;
  isBusy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({
    key: "alpha",
    direction: "asc",
  });
  const filtered = useMemo(
    () =>
      sortListItems(
        filterListItems(
          people,
          query,
          (person) => `${person.rank} ${person.name} ${person.conscriptionNumber ?? ""}`,
        ),
        sort,
        {
          label: (person) => person.name,
          rank: (person) => person.rank,
          defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
        },
      ),
    [people, query, sort],
  );

  return (
    <Drawer title={title} onClose={onClose}>
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        placeholder="Поиск по ФИО, званию или номеру призыва"
        ariaLabel="Поиск и сортировка кандидатов"
        autoFocus
      />
      {pendingConflict && (
        <div
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border border-[oklch(78%_0.16_74/0.38)] bg-[oklch(78%_0.16_74/0.1)] p-2.5 text-amber"
          role="alert"
        >
          <WarningIcon size={18} />
          <div>
            <strong>Есть пересечение</strong>
            <span>
              {pendingConflict.conflicts
                .map((item) => item.groupName)
                .join(", ")}
            </span>
          </div>
          <button
            type="button"
            className="inline-flex min-h-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-2.5 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
            onClick={onConfirmConflict}
            disabled={isBusy}
          >
            Назначить всё равно
          </button>
        </div>
      )}
      <div className="grid gap-1.75">
        {filtered.length === 0 ? (
          <EmptyState
            title="Никого не найдено"
            text="Измените поиск или правила кандидатов."
          />
        ) : (
          filtered.map((person) => (
            <button
              key={person.id}
              type="button"
              className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border border-line bg-[oklch(100%_0_0/0.035)] p-2.25 text-left text-text-primary transition-[border-color,background,transform] duration-200 hover:border-accent-line hover:bg-[oklch(100%_0_0/0.065)] cursor-pointer active:translate-y-px"
              onClick={() => onPick(person.id)}
              disabled={isBusy}
            >
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent-soft text-[11px] font-extrabold text-accent">
                {getInitials(person.name)}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                  {abbreviateName(person.name)}
                </strong>
                <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                  {person.rank}
                </small>
                {person.conscriptionNumber && (
                  <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                    {conscriptionLabel(person.conscriptionNumber)}
                  </small>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    </Drawer>
  );
}

function ExclusionsPanel({
  item,
  isBusy,
  onClose,
  onExclude,
  onInclude,
}: {
  item: DutyGroupSnapshot;
  onClose: () => void;
  onExclude: (
    personId: string,
    dayOfWeek: number | null,
    reason: string,
  ) => Promise<unknown>;
  onInclude: (exclusionId: string) => Promise<unknown>;
  isBusy: boolean;
}) {
  const [personId, setPersonId] = useState("");
  const [exclusionQuery, setExclusionQuery] = useState("");
  const [exclusionSort, setExclusionSort] = useState<ListSortState>({
    key: "alpha",
    direction: "asc",
  });
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const excludedPersonIds = useMemo(
    () => new Set(item.exclusions.map((exclusion) => exclusion.personId)),
    [item.exclusions],
  );
  const peopleOptions = useMemo(() => {
    return item.candidatePeople
      .filter((person) => !excludedPersonIds.has(person.id))
      .map((person) => ({
        value: person.id,
        label: `${abbreviateName(person.name)} · ${person.rank}${person.conscriptionNumber ? ` · ${conscriptionLabel(person.conscriptionNumber)}` : ""}`,
      }));
  }, [excludedPersonIds, item.candidatePeople]);
  const visibleExclusions = useMemo(
    () =>
      sortListItems(
        filterListItems(item.exclusions, exclusionQuery, (exclusion) => {
          const dayLabel =
            exclusion.dayOfWeek === null
              ? "Всегда"
              : DAY_NAMES[exclusion.dayOfWeek];
          return [
            exclusion.personName ?? exclusion.personId,
            exclusion.personRank ?? "",
            exclusion.personConscriptionNumber ?? "",
            exclusion.reason,
            dayLabel,
          ].join(" ");
        }),
        exclusionSort,
        {
          label: (exclusion) => exclusion.personName ?? exclusion.personId,
          rank: (exclusion) => exclusion.personRank ?? "",
          defaultCompare: (a, b) => a.createdAt - b.createdAt,
        },
      ),
    [exclusionQuery, exclusionSort, item.exclusions],
  );
  const dayOptions = [
    { value: "", label: "Всегда" },
    ...[0, 1, 2, 3, 4, 5, 6].map((item) => ({
      value: String(item),
      label: DAY_NAMES[item],
    })),
  ];
  const selectedPersonId = peopleOptions.some(
    (option) => option.value === personId,
  )
    ? personId
    : (peopleOptions[0]?.value ?? "");

  return (
    <Drawer title="Исключения" onClose={onClose}>
      <SearchSortControl
        query={exclusionQuery}
        onQueryChange={setExclusionQuery}
        sort={exclusionSort}
        onSortChange={setExclusionSort}
        placeholder="Поиск по исключённым"
      />
      <div className="grid gap-1.75">
        {item.exclusions.length === 0 ? (
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
            Постоянных исключений нет.
          </p>
        ) : visibleExclusions.length === 0 ? (
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
            Поиск ничего не нашёл.
          </p>
        ) : (
          visibleExclusions.map((exclusion) => (
            <div
              key={exclusion.id}
              className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] border border-line bg-[oklch(100%_0_0/0.035)] p-2.25 text-left text-text-primary"
            >
              <span className="grid min-w-0 gap-0.5">
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                  {exclusion.personName
                    ? abbreviateName(exclusion.personName)
                    : exclusion.personId}
                </strong>
                <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                  {exclusion.personRank && `${exclusion.personRank} · `}
                  {exclusion.personConscriptionNumber && conscriptionLabel(exclusion.personConscriptionNumber)}
                  {!exclusion.personRank && !exclusion.personConscriptionNumber && "Без звания"}
                  {" · "}
                  {exclusion.dayOfWeek === null
                    ? "Всегда"
                    : DAY_NAMES[exclusion.dayOfWeek]}
                </small>
              </span>
              <button
                type="button"
                className="inline-flex h-8.5 min-h-8.5 w-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.04)] p-0 text-text-secondary transition-[background,border-color,transform] duration-200 hover:border-[oklch(69%_0.18_28/0.45)] hover:text-red cursor-pointer active:translate-y-px"
                onClick={() => onInclude(exclusion.id)}
                disabled={isBusy}
                aria-label="Снять исключение"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="grid min-w-0 gap-1.75">
        <span>Добавить человека</span>
        <SelectField
          ariaLabel="Добавить человека в исключения"
          value={selectedPersonId}
          options={peopleOptions}
          onChange={setPersonId}
          searchPlaceholder="Поиск кого исключить"
        />
      </div>
      <div className="grid min-w-0 gap-1.75">
        <span>День</span>
        <SelectField
          ariaLabel="День исключения"
          value={day}
          options={dayOptions}
          onChange={setDay}
        />
      </div>
      <label className="grid min-w-0 gap-1.75">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
          Причина
        </span>
        <input
          className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Например: медчасть, закреплён за другим нарядом"
        />
      </label>
      {peopleOptions.length === 0 && (
        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
          Все подходящие люди уже в исключениях или не найдены.
        </p>
      )}
      <button
        type="button"
        className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
        disabled={isBusy || !selectedPersonId}
        onClick={() =>
          onExclude(selectedPersonId, day === "" ? null : Number(day), reason)
        }
      >
        Добавить исключение
      </button>
    </Drawer>
  );
}

function StyledCheckbox({
  checked,
  label,
  title,
  compact = false,
  onChange,
}: {
  checked: boolean;
  label: string;
  title?: string;
  compact?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex min-h-10.5 max-w-full min-w-0 items-center justify-start gap-2.25 rounded-xl border border-line bg-[linear-gradient(180deg,oklch(100%_0_0/0.065),oklch(100%_0_0/0.035))] px-3 text-left text-[13px] font-bold text-text-secondary shadow-[inset_0_1px_0_oklch(100%_0_0/0.055)] transition-[border-color,background,color,box-shadow,transform] duration-200 hover:border-[oklch(77%_0.14_191/0.46)] hover:bg-[oklch(77%_0.14_191/0.1)] hover:text-text-primary focus-visible:border-[oklch(77%_0.14_191/0.46)] focus-visible:outline-none cursor-pointer active:translate-y-px",
        checked &&
          "border-accent-line bg-[linear-gradient(180deg,oklch(68%_0.19_302/0.2),oklch(68%_0.19_302/0.08))] text-text-primary",
        compact && "min-h-8.5 rounded-full px-2.5 text-xs",
      )}
      role="checkbox"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span
        className="grid h-4.75 w-4.75 flex-none place-items-center rounded-[7px] border border-line-strong bg-[oklch(100%_0_0/0.055)] text-[oklch(81%_0.829_286)]"
        aria-hidden="true"
      >
        {checked && <CheckIcon size={compact ? 12 : 14} weight="bold" />}
      </span>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-0 bg-[oklch(100%_0_0/0.04)] px-3 py-2.5 text-left text-xs font-extrabold text-text-secondary transition-colors duration-150 hover:bg-[oklch(100%_0_0/0.07)]"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{title}</span>
        <CaretDownIcon
          size={16}
          className={cx(
            "transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <DisclosureContent open={open}>
        <div className="grid gap-3 border-t border-line p-3">{children}</div>
      </DisclosureContent>
    </div>
  );
}

function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useDialogFocus(onClose);
  return (
    <div
      className="fixed inset-0 z-90 flex justify-end bg-bg-overlay backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        ref={panelRef}
        className="grid min-h-dvh w-[min(460px,100vw)] min-w-0 content-start gap-3.5 overflow-y-auto border-l border-line bg-[oklch(15%_0.038_286)] p-4 shadow-[-20px_0_60px_rgb(0_0_0/0.32)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tracking-[-0.02em]">
            {title}
          </h2>
          <button
            type="button"
            className="inline-flex h-8.5 min-h-8.5 w-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.04)] p-0 text-text-secondary transition-[background,border-color,transform] duration-200 hover:bg-[oklch(100%_0_0/0.08)] hover:text-text-primary cursor-pointer active:translate-y-px"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <XIcon size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-45 place-items-center gap-2 rounded-[18px] border border-dashed border-line-strong p-5.5 text-center text-text-secondary">
      <ClipboardTextIcon size={28} weight="duotone" />
      <strong className="text-text-primary">{title}</strong>
      <span className="max-w-[36ch] wrap-anywhere text-[13px] leading-normal text-text-muted">
        {text}
      </span>
    </div>
  );
}
