"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwiseIcon,
  CheckIcon,
  ClipboardTextIcon,
  PlusIcon,
  ShieldWarningIcon,
  UserMinusIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  SearchSortControl,
  type SearchSortOption,
} from "@/components/search-sort-control";
import {
  filterListItems,
  sortListItems,
  type ListSortState,
} from "@/components/list-utils";
import { useRealtimeDomain } from "@/features/realtime/RealtimeProvider";
import type { Platoon } from "../roster/types";
import {
  abbreviateName,
  conscriptionLabel,
  getInitials,
} from "../roster/utils";
import type { GroupsSnapshot, RuleUpdateInput } from "./types";
import {
  colorTokenClass,
  DAY_NAMES,
  formatDateLabel,
} from "./utils";
import {
  GroupApiError,
  assignGroupPersonRange,
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
import { CreateGroupPanel } from "./components/create-group-panel";
import { EmptyState } from "./components/empty-state";
import { ExclusionsPanel } from "./components/exclusions-panel";
import { GroupToolbar } from "./components/group-toolbar";
import { PersonPickerPanel } from "./components/person-picker-panel";
import { SettingsPanel } from "./components/settings-panel";
import { iconMap } from "./components/shared-meta";
import { SummaryCard } from "./components/summary-card";
import { WeekStrip } from "./components/week-strip";

type GroupsAppProps = {
  initialSnapshot: GroupsSnapshot;
  canWrite?: boolean;
};

type RuleSavePayload = Omit<RuleUpdateInput, "groupId" | "expectedUpdatedAt">;
type PendingRuleCleanup = { payload: RuleSavePayload; count: number } | null;

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
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isAssignOpen, setAssignOpen] = useState(false);
  const [isExcludeOpen, setExcludeOpen] = useState(false);
  const [pendingRuleCleanup, setPendingRuleCleanup] = useState<PendingRuleCleanup>(null);
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
      // Do not clear the live-unavailable banner here: SSE may still be degraded/closed.
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
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Groups domain always; roster only when people/platoons change eligibility.
  // reason may be comma-unioned by RealtimeProvider debounce (people,location-change).
  const liveStatus = useRealtimeDomain(
    ["groups", "roster", "unknown"],
    (event) => {
      if (event.domain === "roster") {
        const reasons = event.reason.split(",").map((r) => r.trim());
        if (!reasons.includes("people") && !reasons.includes("platoons")) {
          return;
        }
      }
      void refresh();
    },
  );

  const isLiveRefreshUnavailable = liveStatus === "error";

  async function run(
    action: () => Promise<GroupsSnapshot>,
    message = "Операция не выполнена",
    successMessage = "Изменения сохранены",
    rethrowErrors = false,
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
      if (rethrowErrors) throw error;
      return null;
    } finally {
      isMutatingRef.current = false;
      if (isMountedRef.current) setBusy(false);
    }
  }

  async function assignPerson(personId: string, from = effectiveSelectedDate, to = effectiveSelectedDate) {
    if (!canWrite || isMutatingRef.current) return;
    if (!activeGroupId || !from || !to) return;
    isMutatingRef.current = true;
    const revision = ++snapshotRevisionRef.current;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await assignGroupPersonRange(
        activeGroupId,
        personId,
        from,
        to,
      );
      if (revision === snapshotRevisionRef.current) {
        applySnapshot(result.snapshot);
        snapshotRevisionRef.current += 1;
      }
      if (isMountedRef.current) {
        setAssignOpen(false);
        const skipped = result.skippedDates.length;
        setNotice(
          result.assignedDates.length > 0
            ? `Человек назначен на ${result.assignedDates.length} дат${skipped ? `. Пропущено дат: ${skipped}.` : "."}`
            : "Подходящих дат для назначения не найдено.",
        );
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(getGroupErrorMessage(err, "Назначение не выполнено"));
      }
    } finally {
      isMutatingRef.current = false;
      if (isMountedRef.current) setBusy(false);
    }
  }

  async function saveRule(payload: RuleSavePayload) {
    if (!activeSnapshot) return null;
    try {
      const result = await run(
        () =>
          updateRule({
            groupId: activeSnapshot.group.id,
            expectedUpdatedAt: activeSnapshot.group.updatedAt,
            ...payload,
          }),
        "Правила не сохранены",
        "Правила группы сохранены.",
        true,
      );
      setPendingRuleCleanup(null);
      return result;
    } catch (error) {
      if (
        error instanceof GroupApiError &&
        error.code === "GROUP_OVERLAP_CLEANUP_REQUIRED"
      ) {
        setError(null);
        setPendingRuleCleanup({ payload, count: error.cleanupCount });
      }
      return null;
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
      {pendingRuleCleanup && activeSnapshot && (
        <div
          className="grid gap-2 rounded-[12px] border border-[oklch(78%_0.16_74/0.38)] bg-[oklch(78%_0.16_74/0.1)] px-3 py-2.5 text-sm text-amber"
          role="alert"
        >
          <strong>Включение строгого режима удалит {pendingRuleCleanup.count} конфликтующих назначений.</strong>
          <span className="text-xs text-text-secondary">
            Назначения в группе «{activeSnapshot.group.name}» сохранятся, остальные дубли за те же даты будут удалены.
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-8.5 rounded-lg border border-line px-2.5 text-xs font-bold text-text-secondary"
              onClick={() => setPendingRuleCleanup(null)}
              disabled={isBusy}
            >
              Отмена
            </button>
            <button
              type="button"
              className="min-h-8.5 rounded-lg border border-amber/55 bg-amber/18 px-2.5 text-xs font-extrabold text-text-primary"
              onClick={() => void saveRule({ ...pendingRuleCleanup.payload, confirmOverlapCleanup: true })}
              disabled={isBusy}
            >
              Удалить дубли и сохранить
            </button>
          </div>
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
                    onClick={() => {
                      setPendingRuleCleanup(null);
                      setActiveGroupId(group.id);
                    }}
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
            item={activeSnapshot}
            platoons={platoons}
            isBusy={isBusy}
            onSave={saveRule}
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
          groupId={activeSnapshot.group.id}
          availablePeopleByDate={activeSnapshot.availablePeopleByDate}
          initialDate={effectiveSelectedDate}
          onClose={() => {
            setAssignOpen(false);
          }}
          onPick={(personId, from, to) => void assignPerson(personId, from, to)}
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

