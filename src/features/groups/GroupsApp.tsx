"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowClockwiseIcon,
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
  getGroupErrorMessage,
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

const GROUP_NAME_MAX_LENGTH = 120;
const GROUP_NOTES_MAX_LENGTH = 1_000;
const EXCLUSION_REASON_MAX_LENGTH = 500;

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
    const focusTimeout = window.setTimeout(
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
      window.clearTimeout(focusTimeout);
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
  const [isRefreshing, setRefreshing] = useState(false);
  const [isLiveRefreshUnavailable, setLiveRefreshUnavailable] = useState(false);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isAssignOpen, setAssignOpen] = useState(false);
  const [isExcludeOpen, setExcludeOpen] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict>(null);
  const [platoons, setPlatoons] = useState<Platoon[]>(initialSnapshot.platoons);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const isMutatingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const snapshotRevisionRef = useRef(0);
  const isMountedRef = useRef(true);

  const activeSnapshot = activeGroupId
    ? (snapshot.groupSnapshots[activeGroupId] ?? null)
    : null;
  const selectedDay =
    activeSnapshot?.week.find((day) => day.date === selectedDate) ??
    activeSnapshot?.week[0] ??
    null;
  const effectiveSelectedDate = selectedDay?.date ?? selectedDate;
  const selectedAvailablePeople =
    activeSnapshot?.availablePeopleByDate[effectiveSelectedDate] ??
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
    if (!isMountedRef.current) return;
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

  const refresh = useCallback(async (showProgress = false) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    const revision = snapshotRevisionRef.current;
    if (showProgress) setRefreshing(true);
    try {
      const next = await fetchGroupsSnapshot();
      if (isMountedRef.current) setLiveRefreshUnavailable(false);
      if (revision === snapshotRevisionRef.current) {
        applySnapshot(next);
        if (showProgress && isMountedRef.current) setError(null);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setError(getGroupErrorMessage(error, "Не удалось обновить данные групп"));
      }
    } finally {
      isRefreshingRef.current = false;
      if (showProgress && isMountedRef.current) setRefreshing(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    isMountedRef.current = true;
    const source = new EventSource("/api/events");
    source.addEventListener("open", () => {
      if (isMountedRef.current) setLiveRefreshUnavailable(false);
    });
    source.addEventListener("roster", () => void refresh());
    source.addEventListener("error", () => {
      if (isMountedRef.current && source.readyState !== EventSource.CLOSED) {
        setLiveRefreshUnavailable(true);
      }
    });
    return () => {
      isMountedRef.current = false;
      source.close();
    };
  }, [refresh]);

  async function run(
    action: () => Promise<GroupsSnapshot>,
    message = "Операция не выполнена",
    successMessage = "Изменения сохранены",
  ) {
    if (!canWrite || isMutatingRef.current) return null;
    isMutatingRef.current = true;
    const revision = ++snapshotRevisionRef.current;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      if (revision === snapshotRevisionRef.current) {
        applySnapshot(next);
        snapshotRevisionRef.current += 1;
        if (isMountedRef.current) setNotice(successMessage);
      }
      return next;
    } catch (error) {
      if (isMountedRef.current) setError(getGroupErrorMessage(error, message));
      return null;
    } finally {
      isMutatingRef.current = false;
      if (isMountedRef.current) setBusy(false);
    }
  }

  async function assignPerson(personId: string, allowConflict = false) {
    if (!canWrite || isMutatingRef.current) return;
    if (!activeGroupId || !effectiveSelectedDate) return;
    isMutatingRef.current = true;
    const revision = ++snapshotRevisionRef.current;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await assignGroupPerson(
        activeGroupId,
        personId,
        effectiveSelectedDate,
        allowConflict,
      );
      if (revision === snapshotRevisionRef.current) {
        applySnapshot(next);
        snapshotRevisionRef.current += 1;
      }
      if (isMountedRef.current) {
        setAssignOpen(false);
        setPendingConflict(null);
        setNotice(
          allowConflict
            ? "Назначение добавлено с подтверждённым пересечением."
            : "Человек назначен.",
        );
      }
    } catch (err) {
      if (
        err instanceof GroupApiError &&
        err.code === "GROUP_ASSIGNMENT_CONFLICT" &&
        err.conflicts.length > 0 &&
        isMountedRef.current
      ) {
        setPendingConflict({ personId, conflicts: err.conflicts });
      } else if (isMountedRef.current) {
        setError(getGroupErrorMessage(err, "Назначение не выполнено"));
      }
    } finally {
      isMutatingRef.current = false;
      if (isMountedRef.current) setBusy(false);
    }
  }

  return (
    <section
      className="grid min-w-0 max-w-full gap-3.5 p-3 text-text-primary md:gap-4 md:p-4.5"
      aria-busy={isBusy || isRefreshing}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {isBusy ? "Сохраняем изменения" : isRefreshing ? "Обновляем данные" : ""}
      </p>
      {notice && (
        <div
          className="flex min-w-0 items-center gap-2 rounded-[10px] border border-[oklch(76%_0.17_151/0.3)] bg-[oklch(76%_0.17_151/0.1)] px-3 py-2 text-xs text-green"
          role="status"
          aria-live="polite"
        >
          <CheckIcon size={16} weight="bold" />
          <span className="min-w-0 wrap-anywhere">{notice}</span>
        </div>
      )}
      <header className="grid min-w-0 items-center gap-3 border-b border-line pb-3.5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h1 className="m-0 max-w-full wrap-anywhere text-[clamp(24px,3vw,34px)] font-bold leading-[1.06] tracking-[-0.03em]">
            Распределение по группам
          </h1>
        </div>
        <div
          className="grid min-w-0 grid-cols-3 divide-x divide-line"
          role="group"
          aria-label="Сводка групп"
        >
          <SummaryCard label="Назначено сегодня" value={assignedToday} />
          <SummaryCard
            label="Назначений за неделю"
            value={weekAssignments}
          />
          <SummaryCard
            label="Пересечения сегодня"
            value={totalConflicts}
            tone={totalConflicts > 0 ? "warn" : "ok"}
          />
        </div>
      </header>

      {error && (
        <div
          className="grid min-w-0 gap-2 rounded-[10px] border border-[oklch(78%_0.16_74/0.35)] bg-[oklch(78%_0.16_74/0.1)] p-3 text-amber sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
          role="alert"
        >
          <WarningIcon size={18} />
          <div className="min-w-0">
            <strong className="block text-sm text-text-primary">Действие не завершено</strong>
            <span className="block wrap-anywhere text-xs">{error}</span>
          </div>
          <button
            type="button"
            className="inline-flex min-h-8.5 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[oklch(78%_0.16_74/0.42)] bg-[oklch(100%_0_0/0.045)] px-2.5 text-xs font-extrabold text-text-primary transition-[border-color,background,color] duration-200 hover:border-amber hover:bg-[oklch(78%_0.16_74/0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:cursor-not-allowed"
            onClick={() => void refresh(true)}
            disabled={isBusy || isRefreshing}
          >
            <ArrowClockwiseIcon size={15} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Обновляем" : "Обновить данные"}
          </button>
        </div>
      )}
      {isLiveRefreshUnavailable && !error && (
        <div
          className="grid min-w-0 gap-2 rounded-[10px] border border-line bg-bg-panel/70 p-3 text-xs text-text-secondary sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          role="status"
        >
          <span className="min-w-0 wrap-anywhere">
            Автообновление временно недоступно. Данные можно обновить вручную.
          </span>
          <button
            type="button"
            className="inline-flex min-h-8.5 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.5 text-xs font-extrabold text-text-primary transition-[border-color,background,color] duration-200 hover:border-accent-line hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:cursor-not-allowed"
            onClick={() => void refresh(true)}
            disabled={isBusy || isRefreshing}
          >
            <ArrowClockwiseIcon size={15} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Обновляем" : "Обновить"}
          </button>
        </div>
      )}
      {!canWrite && (
        <div
          className="flex min-w-0 items-center gap-2 wrap-anywhere rounded-[10px] border border-[oklch(78%_0.16_74/0.35)] bg-[oklch(78%_0.16_74/0.1)] px-3 py-2 text-xs text-amber"
          role="status"
        >
          Режим просмотра — создавать и изменять назначения нельзя.
        </div>
      )}

      <div className="grid min-w-0 items-start gap-3.5 lg:grid-cols-[minmax(210px,250px)_minmax(0,1fr)] xl:grid-cols-[minmax(210px,250px)_minmax(0,1fr)_minmax(260px,310px)]">
        <aside
          className="grid min-w-0 gap-2.5 p-0"
          aria-label="Список групп"
        >
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-text-secondary">
            <span>Группы</span>
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
                По этому запросу группы не найдены. Измените поиск.
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
                    className={`grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-(--tone-line) bg-[oklch(100%_0_0/0.035)] px-2.5 py-2 text-left text-text-primary transition-[border-color,background,transform] duration-200 hover:border-accent-line hover:bg-[oklch(100%_0_0/0.065)] cursor-pointer active:translate-y-px ${activeGroupId === group.id ? "border-(--tone-line) bg-(--tone-soft)" : ""} ${colorTokenClass(item?.template.colorToken ?? "neutral")}`}
                    onClick={() => setActiveGroupId(group.id)}
                    aria-pressed={activeGroupId === group.id}
                    title={group.name}
                  >
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-(--tone-soft) text-(--tone)">
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

        <main className="grid min-w-0 gap-3">
          {activeSnapshot && selectedDay ? (
            <>
              <GroupToolbar
                item={activeSnapshot}
                selectedDate={effectiveSelectedDate}
                onRotate={() =>
                run(
                  () => rotateGroup(activeSnapshot.group.id, effectiveSelectedDate),
                  "Ротация не выполнена",
                  `Ротация запущена на ${formatDateLabel(effectiveSelectedDate)}.`,
                )
                }
                onAssign={() => setAssignOpen(true)}
                onToggle={() =>
                  run(() =>
                    updateGroup({
                      id: activeSnapshot.group.id,
                      expectedUpdatedAt: activeSnapshot.group.updatedAt,
                      enabled: !activeSnapshot.group.enabled,
                    }),
                  )
                }
                disabled={isBusy || !canWrite}
              />
              <WeekStrip
                item={activeSnapshot}
                selectedDate={effectiveSelectedDate}
                onSelect={setSelectedDate}
              />
              <section className="grid gap-3 border-t border-line pt-3">
                <div className="grid min-w-0 gap-2.5 min-[560px]:flex min-[560px]:items-center min-[560px]:justify-between">
                  <div className="min-w-0">
                    <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tracking-[-0.02em]">
                      {formatDateLabel(effectiveSelectedDate)} ·{" "}
                      {DAY_NAMES[selectedDay.dayOfWeek]}
                    </h2>
                    <p className="m-0 mt-0.75 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                      {selectedDay.isActive
                        ? "На эту дату группа работает по расписанию"
                        : "Этот день выключен в правилах группы"}
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
                    text="Запустите ротацию или назначьте человека вручную."
                  />
                ) : visibleAssignments.length === 0 ? (
                  <EmptyState
                    title="Ничего не найдено"
                    text="Измените поиск или сортировку назначений."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-0 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
                    {visibleAssignments.map((assignment) => (
                      <article
                        key={assignment.id}
                        className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${assignment.conflicts.length > 0 ? "rounded-[10px] border border-[oklch(78%_0.16_74/0.45)] bg-[oklch(78%_0.16_74/0.08)] px-2.5" : ""}`}
                      >
                        <div className="grid h-8.5 w-8.5 flex-none place-items-center rounded-full bg-accent-soft text-xs font-extrabold text-accent">
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
                            <em
                              className="flex min-w-0 items-start gap-1.25 wrap-anywhere text-xs not-italic text-amber"
                              title={assignment.conflicts.map((item) => item.groupName).join(", ")}
                            >
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
                            aria-label={`Снять назначение: ${assignment.personName ?? assignment.personId}`}
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
              text="Создайте группу из шаблона — после этого можно запускать ротацию."
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
                  updateRule({
                    groupId: activeSnapshot.group.id,
                    expectedUpdatedAt: activeSnapshot.group.updatedAt,
                    ...payload,
                  }),
                  "Правила не сохранены",
                  "Правила группы сохранены.",
                )
            }
            onRename={(payload) =>
              run(
                () =>
                  updateGroup({
                    id: activeSnapshot.group.id,
                    expectedUpdatedAt: activeSnapshot.group.updatedAt,
                    ...payload,
                  }),
                  "Группа не сохранена",
                  "Описание группы сохранено.",
                )
            }
            onDelete={() =>
              void run(
                () => deleteGroup(activeSnapshot.group.id),
                "Группа не удалена",
                "Группа удалена.",
              )
            }
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
          selectedDate={effectiveSelectedDate}
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
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="min-w-0 px-3 py-0.5 first:pl-0 last:pr-0">
      <span className="block min-h-[2.4em] text-[11px] leading-tight font-bold text-text-muted">
        {label}
      </span>
      <strong
        className={`my-0.5 block overflow-hidden text-ellipsis font-mono text-xl leading-none ${tone === "ok" ? "text-green" : tone === "warn" ? "text-amber" : "text-text-primary"}`}
      >
        {value}
      </strong>
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
      className={`grid min-w-0 items-center gap-3 rounded-[16px] border border-(--tone-line) bg-bg-panel p-3 min-[1800px]:grid-cols-[minmax(0,1fr)_auto] ${colorTokenClass(item.template.colorToken)}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9.5 w-9.5 flex-none place-items-center rounded-[14px] bg-(--tone-soft) text-(--tone)">
          <Icon size={24} weight="duotone" />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tracking-[-0.02em]" title={item.group.name}>
            {item.group.name}
          </h2>
          <p className="m-0 mt-0.75 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
            {item.template.name} · {item.rule.peoplePerDay} чел. в день ·{" "}
            {priorityModeLabels[item.rule.priorityMode]}
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
          {item.group.enabled ? "Отключить группу" : "Включить группу"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-3.25 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
          onClick={onRotate}
          disabled={disabled}
        >
          <CalendarBlankIcon size={17} /> Запустить ротацию{" "}
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
      className="min-w-0 overflow-x-auto rounded-xl border border-line bg-bg-panel/45"
      aria-label="План на неделю"
    >
      <div className="grid min-w-[560px] grid-cols-7 sm:min-w-0 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {item.week.map((day) => (
          <button
            key={day.date}
            type="button"
            className={`relative grid min-w-0 gap-0.5 border-0 border-r border-line p-2.5 text-left text-text-primary transition-[background,color] duration-200 last:border-r-0 hover:bg-[oklch(100%_0_0/0.065)] focus-visible:z-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan cursor-pointer ${selectedDate === day.date ? "bg-accent-soft" : "bg-transparent"} ${!day.isActive ? "bg-[oklch(100%_0_0/0.025)] opacity-[0.72]" : ""}`}
            onClick={() => onSelect(day.date)}
            aria-pressed={selectedDate === day.date}
            aria-label={`${formatDayLabel(day.dayOfWeek)}, ${formatDateLabel(day.date)}${day.isActive ? "" : ", день выключен"}`}
          >
            <span className="text-[11px] font-bold text-text-muted">
              {formatDayLabel(day.dayOfWeek)}
            </span>
            <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
              {formatDateLabel(day.date)}
            </strong>
            <small className="text-[11px] font-bold text-text-muted">
              {day.isActive
                ? `${day.assignments.length}/${item.rule.peoplePerDay}`
                : "Выкл."}
            </small>
            {day.conflictsCount > 0 && (
              <em className="absolute right-1.5 top-1.5 min-w-4.5 rounded-full bg-amber text-center font-mono text-[10px] font-black not-italic text-[oklch(15%_0.035_286)]">
                {day.conflictsCount}
              </em>
            )}
          </button>
        ))}
      </div>
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
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.group.name);
  const [notes, setNotes] = useState(item.group.notes);
  const [nameTouched, setNameTouched] = useState(false);
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
              disabled={isBusy || peoplePerDay <= 1}
              aria-label="Уменьшить количество людей в день"
            >
              -
            </button>
            <strong className="grid place-items-center border-x border-line font-mono">
              {peoplePerDay}
            </strong>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-text-primary disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() =>
                setPeoplePerDay((value) => Math.min(40, value + 1))
              }
              disabled={isBusy || peoplePerDay >= 40}
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
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
            Кого брать в ротацию
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
              Если ничего не выбрано — берём из всех подразделений.
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
  const [nameTouched, setNameTouched] = useState(false);
  const nameError = nameTouched && !name.trim() ? "Введите название группы." : null;

  return (
    <Drawer title="Новая группа" onClose={onClose}>
      {templates.length === 0 ? (
        <EmptyState
          title="Нет шаблонов для группы"
          text="Добавьте шаблон в справочниках, затем вернитесь к созданию группы."
        />
      ) : (
        <>
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
                  aria-pressed={templateId === template.id}
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
              className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-base text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setNameTouched(true)}
              maxLength={GROUP_NAME_MAX_LENGTH}
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby="create-group-name-hint"
            />
            <small
              id="create-group-name-hint"
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
            className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
            disabled={isBusy || !name.trim() || !templateId}
            onClick={() => onCreate({ name: name.trim(), templateId, notes })}
          >
            Создать
          </button>
        </>
      )}
    </Drawer>
  );
}

function PersonPickerPanel({
  title,
  people,
  pendingConflict,
  selectedDate,
  isBusy,
  onClose,
  onPick,
  onConfirmConflict,
}: {
  title: string;
  people: Person[];
  pendingConflict: PendingConflict;
  selectedDate: string;
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
  const pendingPerson = pendingConflict
    ? people.find((person) => person.id === pendingConflict.personId)
    : null;

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
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border border-[oklch(78%_0.16_74/0.38)] bg-[oklch(78%_0.16_74/0.1)] p-2.5 text-amber sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          role="alert"
        >
          <WarningIcon size={18} />
          <div className="min-w-0">
            <strong className="block">Назначение пересекается</strong>
            <span className="block wrap-anywhere text-xs">
              {pendingPerson ? `${abbreviateName(pendingPerson.name)} · ` : ""}
              {formatDateLabel(selectedDate)}. Уже есть в: {pendingConflict.conflicts
                .map((item) => item.groupName)
                .join(", ")}.
            </span>
          </div>
          <button
            type="button"
            className="col-span-full inline-flex min-h-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-[oklch(78%_0.16_74/0.5)] bg-[oklch(78%_0.16_74/0.16)] px-2.5 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 hover:border-amber hover:bg-[oklch(78%_0.16_74/0.22)] cursor-pointer active:translate-y-px sm:col-span-1"
            onClick={onConfirmConflict}
            disabled={isBusy}
          >
            Назначить с конфликтом
          </button>
        </div>
      )}
      <div className="grid gap-1.75">
        {filtered.length === 0 ? (
          <EmptyState
            title={people.length === 0 ? "Нет кандидатов на выбранную дату" : "Никого не найдено"}
            text={
              people.length === 0
                ? "Проверьте исключения и правила группы или выберите другую дату."
                : "Измените поиск или правила кандидатов."
            }
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
  ) ? personId : "";

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
                aria-label={`Снять исключение: ${exclusion.personName ?? exclusion.personId}`}
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
          placeholder="Выберите человека"
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
          className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-base text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={EXCLUSION_REASON_MAX_LENGTH}
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
        "inline-flex min-h-10.5 max-w-full min-w-0 items-center justify-start gap-2.25 rounded-xl border border-line bg-[oklch(100%_0_0/0.04)] px-3 text-left text-[13px] font-bold text-text-secondary transition-[border-color,background,color,transform] duration-200 hover:border-[oklch(77%_0.14_191/0.46)] hover:bg-[oklch(77%_0.14_191/0.1)] hover:text-text-primary focus-visible:border-[oklch(77%_0.14_191/0.46)] focus-visible:outline-none cursor-pointer active:translate-y-px",
        checked &&
          "border-accent-line bg-accent-soft text-text-primary",
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
    <div className="overflow-hidden border-t border-line">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-0 bg-transparent px-0 py-3 text-left text-xs font-extrabold text-text-secondary transition-colors duration-150 hover:text-text-primary"
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
        <div className="grid gap-3 pb-3">{children}</div>
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
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tracking-[-0.02em]" title={title}>
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
