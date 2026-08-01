"use client";

import {
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  DownloadSimpleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SelectField } from "@/components/select-field";
import { useRealtimeDomain } from "@/features/realtime/RealtimeProvider";
import { ApiError, getApiErrorMessage } from "@/lib/api-client";
import {
  assignSchedulePerson,
  fetchScheduleSnapshot,
  removeScheduleAssignment,
} from "./api";
import { exportScheduleCsv, buildScheduleCsv } from "./csv";
import {
  assignmentsForCell,
  compactDutyLabel,
  dateKey,
  groupById,
  scheduleDateLabel,
  scheduleDateRange,
  scheduleDayLabel,
  scheduleMonthKey,
  scheduleMonthLabel,
  schedulePresetRange,
  scheduleAssignmentState,
  type SchedulePreset,
} from "./logic";
import type { GroupAssignment, GroupRule } from "../groups/types";
import type { ScheduleSnapshot } from "./types";

const dutyTones = [
  "border-cyan/35 bg-cyan/12 text-cyan",
  "border-green/35 bg-green/12 text-green",
  "border-amber/35 bg-amber/12 text-amber",
  "border-blue/35 bg-blue/12 text-blue",
  "border-violet/35 bg-violet/12 text-violet",
  "border-red/35 bg-red/12 text-red",
];

function toneFor(index: number) {
  return dutyTones[index % dutyTones.length];
}

function pluralPeople(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return "человек";
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return "человека";
  return "человек";
}

function monthBounds(month: string) {
  const [year, value] = month.split("-").map(Number);
  return {
    from: dateKey(new Date(year, value - 1, 1)),
    to: dateKey(new Date(year, value, 0)),
  };
}

type CellTarget = { personId: string; date: string } | null;
type PersonView = "all" | "assigned" | "unassigned" | "conflicts";

function getScheduleAssignmentErrorMessage(cause: unknown) {
  if (!(cause instanceof ApiError)) {
    return getApiErrorMessage(cause, "Назначение не выполнено. Проверьте правила группы и конфликты.");
  }
  if (cause.code === "GROUP_ASSIGNMENT_CONFLICT") {
    return "Назначение заблокировано: человек уже назначен в другую строгую группу на эту дату.";
  }
  if (cause.code === "GROUP_ASSIGNMENT_OVERFILLED") {
    return "На выбранную дату в этой группе уже назначено нужное количество людей.";
  }
  if (cause.code === "GROUP_ASSIGNMENT_INELIGIBLE") {
    const payload = cause.payload;
    const reason = payload && typeof payload === "object" && "reason" in payload
      ? (payload as { reason?: unknown }).reason
      : null;
    if (reason === "inactive_day") return "Эта группа не работает в выбранный день.";
    if (reason === "platoon_disabled") return "Подразделение человека не входит в правила группы.";
    if (reason === "excluded") return "Человек исключён из этой группы на выбранный день.";
    if (reason === "group_disabled") return "Группа отключена в настройках.";
  }
  return getApiErrorMessage(cause, "Назначение не выполнено. Проверьте правила группы и конфликты.");
}

export function ScheduleApp({
  initialSnapshot,
  onOpenGroups,
  onSnapshotChange,
  canWrite = false,
}: {
  initialSnapshot: ScheduleSnapshot;
  onOpenGroups: () => void;
  onSnapshotChange?: (snapshot: ScheduleSnapshot) => void;
  canWrite?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [from, setFrom] = useState(initialSnapshot.from);
  const [to, setTo] = useState(initialSnapshot.to);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cellTarget, setCellTarget] = useState<CellTarget>(null);
  const [editorGroupId, setEditorGroupId] = useState(initialSnapshot.groups[0]?.id ?? "");
  const [personQuery, setPersonQuery] = useState("");
  const [platoonFilter, setPlatoonFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [personView, setPersonView] = useState<PersonView>("all");
  const snapshotRequestRef = useRef(0);

  const applySnapshot = useCallback((next: ScheduleSnapshot) => {
    setSnapshot(next);
    setFrom(next.from);
    setTo(next.to);
    onSnapshotChange?.(next);
  }, [onSnapshotChange]);

  const loadSnapshot = useCallback(async (nextFrom: string, nextTo: string) => {
    const requestId = ++snapshotRequestRef.current;
    const next = await fetchScheduleSnapshot(nextFrom, nextTo);
    if (requestId !== snapshotRequestRef.current) return false;
    applySnapshot(next);
    return true;
  }, [applySnapshot]);

  const refresh = useCallback(async () => {
    try {
      await loadSnapshot(snapshot.from, snapshot.to);
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Не удалось обновить график. Проверьте соединение и повторите попытку."));
    }
  }, [loadSnapshot, snapshot.from, snapshot.to]);

  useRealtimeDomain(["groups", "roster", "unknown"], () => {
    void refresh();
  });

  const groupMap = useMemo(() => groupById(snapshot.groups), [snapshot.groups]);
  const groupToneMap = useMemo(
    () => new Map(snapshot.groups.map((group, index) => [group.id, toneFor(index)])),
    [snapshot.groups],
  );
  const assignmentMap = useMemo(() => {
    const map = new Map<string, GroupAssignment[]>();
    for (const assignment of snapshot.assignments) {
      const key = `${assignment.personId}\u0000${assignment.assignedDate}`;
      const current = map.get(key) ?? [];
      current.push(assignment);
      map.set(key, current);
    }
    return map;
  }, [snapshot.assignments]);
  const peopleByPlatoon = useMemo(() => {
    const known = new Set(snapshot.platoons.map((platoon) => platoon.id));
    const sections = snapshot.platoons.map((platoon) => ({
      id: platoon.id,
      label: platoon.label,
      people: snapshot.people.filter((person) => person.platoonId === platoon.id),
    })).filter((section) => section.people.length > 0);
    const unassigned = snapshot.people.filter((person) => !known.has(person.platoonId));
    if (unassigned.length) sections.push({ id: "unknown", label: "Без подразделения", people: unassigned });
    return sections;
  }, [snapshot.people, snapshot.platoons]);
  const filteredPeopleByPlatoon = useMemo(() => {
    const needle = personQuery.trim().toLocaleLowerCase("ru-RU");
    const assignedPeople = new Set(snapshot.assignments.map((assignment) => assignment.personId));
    const conflictPeople = new Set(
      snapshot.assignments
        .filter((assignment) => assignment.conflictState === "warning")
        .map((assignment) => assignment.personId),
    );
    const groupPeople = new Set(
      snapshot.assignments
        .filter((assignment) => groupFilter === "all" || assignment.groupId === groupFilter)
        .map((assignment) => assignment.personId),
    );

    return peopleByPlatoon
      .filter((section) => platoonFilter === "all" || section.id === platoonFilter)
      .map((section) => ({
        ...section,
        people: section.people.filter((person) => {
          const haystack = [person.name, person.rank, person.conscriptionNumber ?? ""]
            .join(" ")
            .toLocaleLowerCase("ru-RU");
          if (needle && !haystack.includes(needle)) return false;
          if (groupFilter !== "all" && !groupPeople.has(person.id)) return false;
          if (personView === "assigned" && !assignedPeople.has(person.id)) return false;
          if (personView === "unassigned" && assignedPeople.has(person.id)) return false;
          if (personView === "conflicts" && !conflictPeople.has(person.id)) return false;
          return true;
        }),
      }))
      .filter((section) => section.people.length > 0);
  }, [groupFilter, peopleByPlatoon, personQuery, personView, platoonFilter, snapshot.assignments]);
  const visiblePeopleCount = filteredPeopleByPlatoon.reduce((total, section) => total + section.people.length, 0);
  const displayedAssignmentMap = useMemo(() => {
    if (groupFilter === "all") return assignmentMap;
    const filtered = new Map<string, GroupAssignment[]>();
    for (const [key, assignments] of assignmentMap) {
      const matching = assignments.filter((assignment) => assignment.groupId === groupFilter);
      if (matching.length) filtered.set(key, matching);
    }
    return filtered;
  }, [assignmentMap, groupFilter]);
  const hasPeopleFilters = Boolean(personQuery.trim()) || groupFilter !== "all" || platoonFilter !== "all" || personView !== "all";
  const platoonOptions = useMemo(
    () => [
      { value: "all", label: "Все подразделения" },
      ...peopleByPlatoon.map((section) => ({ value: section.id, label: section.label })),
    ],
    [peopleByPlatoon],
  );
  const groupOptions = useMemo(
    () => [
      { value: "all", label: "Все группы" },
      ...snapshot.groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [snapshot.groups],
  );
  const statusOptions = [
    { value: "all", label: "Все люди" },
    { value: "assigned", label: "Есть назначение" },
    { value: "unassigned", label: "Без назначений" },
    { value: "conflicts", label: "Только конфликты" },
  ];
  const months = useMemo(
    () => [...new Set(snapshot.dates.map(scheduleMonthKey))],
    [snapshot.dates],
  );
  const isLongRange = snapshot.dates.length > 31;
  const rowsCount = snapshot.people.length;
  const conflictsCount = snapshot.assignments.filter((assignment) => assignment.conflictState === "warning").length;
  const selectedAssignments = cellTarget
    ? assignmentsForCell(snapshot.assignments, cellTarget.personId, cellTarget.date)
    : [];
  const selectedPerson = cellTarget ? snapshot.people.find((person) => person.id === cellTarget.personId) : null;
  const selectedGroupAlreadyAssigned = selectedAssignments.some((assignment) => assignment.groupId === editorGroupId);

  useEffect(() => {
    if (!cellTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCellTarget(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cellTarget]);

  async function applyRange(nextFrom = from, nextTo = to) {
    if (pending) return;
    if (!scheduleDateRange(nextFrom, nextTo)) {
      setError("Выберите корректный диапазон до 366 дней.");
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    setCellTarget(null);
    try {
      await loadSnapshot(nextFrom, nextTo);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Не удалось загрузить выбранный диапазон графика."));
    } finally {
      setPending(false);
    }
  }

  function choosePreset(preset: SchedulePreset) {
    const range = schedulePresetRange(preset);
    setFrom(range.from);
    setTo(range.to);
    void applyRange(range.from, range.to);
  }

  async function editAssignment(action: () => Promise<unknown>, success: string) {
    if (!canWrite || pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await loadSnapshot(snapshot.from, snapshot.to);
      setNotice(success);
    } catch (cause) {
      const message = getScheduleAssignmentErrorMessage(cause);
      try {
        await loadSnapshot(snapshot.from, snapshot.to);
      } catch {
        // Keep the mutation error visible when the recovery read also fails.
      }
      setError(message);
    } finally {
      setPending(false);
    }
  }

  function showToday() {
    choosePreset("today");
  }

  function resetPeopleFilters() {
    setPersonQuery("");
    setPlatoonFilter("all");
    setGroupFilter("all");
    setPersonView("all");
  }

  return (
    <section className="schedule-screen grid min-w-0 max-w-[1680px] gap-4 p-4.5 text-text-primary max-[760px]:gap-3 max-[760px]:p-3">
      <header className="schedule-toolbar relative overflow-hidden rounded-[26px] border border-line bg-[radial-gradient(circle_at_88%_12%,oklch(77%_0.14_191/0.16),transparent_25%),linear-gradient(135deg,oklch(21%_0.055_286),oklch(15%_0.038_286))] p-5.5 shadow-(--shadow) max-[760px]:p-4">
        <div className="relative z-1 flex items-start justify-between gap-5 max-[900px]:flex-col">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-cyan">
              <CalendarBlankIcon size={16} aria-hidden="true" /> Оперативный документ
            </div>
            <h1 className="m-0 mt-2 text-[clamp(30px,4vw,46px)] font-extrabold leading-[0.98] tracking-[-0.045em]">График нарядов</h1>
            <p className="m-0 mt-2 max-w-[64ch] text-sm leading-6 text-text-secondary">
              Планируйте назначения на неделю, месяц или весь календарный год. Быстрые диапазоны загружаются сразу, а нажатие по ячейке открывает редактор.
            </p>
          </div>
          <div className="grid min-w-[min(100%,390px)] grid-cols-3 gap-2 max-[480px]:w-full max-[480px]:min-w-0">
            <Summary label="Людей" value={rowsCount} />
            <Summary label="Назначений" value={snapshot.assignments.length} />
            <Summary label="Конфликтов" value={conflictsCount} tone={conflictsCount ? "amber" : "green"} />
          </div>
        </div>
        <div className="schedule-controls mt-5 flex flex-wrap items-end gap-2.5 border-t border-white/10 pt-3.5">
          <DateField label="С" value={from} onChange={setFrom} />
          <DateField label="По" value={to} onChange={setTo} />
          <button type="button" className="min-h-10.5 rounded-[11px] border border-accent bg-accent px-3.5 text-sm font-extrabold text-[oklch(12%_0.04_286)] transition hover:brightness-110 disabled:opacity-55" onClick={() => void applyRange()} disabled={pending}>
            {pending ? "Загрузка…" : "Показать"}
          </button>
          <button type="button" className="min-h-10.5 rounded-[11px] border border-line bg-white/5 px-3.5 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary disabled:opacity-55" onClick={showToday} disabled={pending}>Сегодня</button>
          <div className="flex flex-wrap gap-1.5" aria-label="Быстрый диапазон">
            {([
              ["seven", "7 дней"],
              ["week", "Неделя"],
              ["thirty", "30 дней"],
              ["month", "Месяц"],
              ["year", "Год"],
            ] as const).map(([preset, label]) => (
              <button key={preset} type="button" className="min-h-10.5 rounded-[11px] border border-line bg-white/5 px-3 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary disabled:opacity-55" onClick={() => choosePreset(preset)} disabled={pending}>{label}</button>
            ))}
          </div>
          <span className="flex-1" />
          <button type="button" className="min-h-10.5 rounded-[11px] border border-line bg-white/5 px-3.5 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary" onClick={onOpenGroups}>Настроить группы</button>
          <button type="button" className="inline-flex min-h-10.5 items-center gap-2 rounded-[11px] border border-line bg-white/5 px-3.5 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary" onClick={() => window.print()}><PrinterIcon size={17} aria-hidden="true" /> Печать</button>
          <button type="button" className="inline-flex min-h-10.5 items-center gap-2 rounded-[11px] border border-line bg-white/5 px-3.5 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary" onClick={() => exportScheduleCsv(buildScheduleCsv(snapshot), snapshot.from, snapshot.to)}><DownloadSimpleIcon size={17} aria-hidden="true" /> CSV</button>
        </div>
      </header>

      {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-red/35 bg-red/8 px-3.5 py-3 text-sm text-red" role="alert"><span>{error}</span><button type="button" className="inline-flex min-h-8.5 items-center gap-1.5 rounded-lg border border-red/35 px-2.5 text-xs font-bold" onClick={() => void refresh()}><ArrowsClockwiseIcon size={15} /> Повторить</button></div>}
      {notice && <div className="rounded-xl border border-green/30 bg-green/8 px-3.5 py-3 text-sm text-green" role="status">{notice}</div>}

      <div className="schedule-legend flex min-w-0 flex-wrap items-center gap-2 rounded-[18px] border border-line bg-bg-panel px-3.5 py-3">
        <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Наряды</span>
        {snapshot.groups.map((group, index) => <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${toneFor(index)}`} key={group.id} title={group.name}><i className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" /><span className="max-w-48 overflow-hidden text-ellipsis whitespace-nowrap">{compactDutyLabel(group.name)} · {group.name}{snapshot.groupRules?.[group.id]?.overlapPolicy === "manual" ? " · ручное совмещение" : ""}</span></span>)}
        {!snapshot.groups.length && <span className="text-sm text-text-muted">Группы нарядов ещё не созданы.</span>}
      </div>

      {isLongRange ? (
        <YearSummary snapshot={snapshot} months={months} onDrill={(month) => { const range = monthBounds(month); void applyRange(range.from, range.to); }} />
      ) : (
        <section className="grid min-w-0 gap-3" aria-label="Рабочая область графика">
          <ScheduleFilters
            personQuery={personQuery}
            onPersonQuery={setPersonQuery}
            platoonFilter={platoonFilter}
            onPlatoonFilter={setPlatoonFilter}
            groupFilter={groupFilter}
            onGroupFilter={setGroupFilter}
            personView={personView}
            onPersonView={(value) => setPersonView(value as PersonView)}
            platoonOptions={platoonOptions}
            groupOptions={groupOptions}
            statusOptions={statusOptions}
            visiblePeopleCount={visiblePeopleCount}
            totalPeopleCount={snapshot.people.length}
            hasFilters={hasPeopleFilters}
            onReset={resetPeopleFilters}
          />
          <div className="min-w-0">
            <ScheduleMatrix
              snapshot={snapshot}
              peopleByPlatoon={filteredPeopleByPlatoon}
              visiblePeopleCount={visiblePeopleCount}
              assignmentMap={displayedAssignmentMap}
              groupMap={groupMap}
              groupToneMap={groupToneMap}
              canWrite={canWrite}
              onCell={(personId, date) => {
                setCellTarget({ personId, date });
                setEditorGroupId(snapshot.groups[0]?.id ?? "");
                setError(null);
                setNotice(null);
              }}
            />
            {canWrite && cellTarget && selectedPerson ? (
              <AssignmentEditor
                selectedPerson={selectedPerson}
                cellTarget={cellTarget}
                selectedAssignments={selectedAssignments}
                groups={snapshot.groups}
                groupMap={groupMap}
                groupRules={snapshot.groupRules}
                editorGroupId={editorGroupId}
                selectedGroupAlreadyAssigned={selectedGroupAlreadyAssigned}
                pending={pending}
                error={error}
                notice={notice}
                onGroupChange={setEditorGroupId}
                onClose={() => setCellTarget(null)}
                onAssign={() => void editAssignment(() => assignSchedulePerson(editorGroupId, selectedPerson.id, cellTarget.date), "Ручное назначение добавлено.")}
                onRemove={(assignment) => void editAssignment(() => removeScheduleAssignment(assignment.id), "Назначение снято.")}
              />
            ) : null}
          </div>
        </section>
      )}
      <p className="schedule-print-note m-0 text-xs text-text-muted">Период: {snapshot.from} — {snapshot.to}. Допустимо выбрать до 366 дней. Автоматическая генерация не удаляет ручные назначения.</p>
    </section>
  );
}

function ScheduleFilters({
  personQuery,
  onPersonQuery,
  platoonFilter,
  onPlatoonFilter,
  groupFilter,
  onGroupFilter,
  personView,
  onPersonView,
  platoonOptions,
  groupOptions,
  statusOptions,
  visiblePeopleCount,
  totalPeopleCount,
  hasFilters,
  onReset,
}: {
  personQuery: string;
  onPersonQuery: (value: string) => void;
  platoonFilter: string;
  onPlatoonFilter: (value: string) => void;
  groupFilter: string;
  onGroupFilter: (value: string) => void;
  personView: PersonView;
  onPersonView: (value: string) => void;
  platoonOptions: Array<{ value: string; label: string }>;
  groupOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  visiblePeopleCount: number;
  totalPeopleCount: number;
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <section className="grid gap-3 rounded-[18px] border border-line bg-bg-panel p-3.5" aria-label="Фильтры состава">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan/12 text-cyan"><FunnelIcon size={18} weight="bold" aria-hidden="true" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="m-0 text-sm font-extrabold">Рабочий состав</h2>
              <span className="rounded-full border border-line bg-white/4 px-2 py-0.5 font-mono text-[11px] font-bold text-text-secondary" aria-live="polite">{visiblePeopleCount} из {totalPeopleCount}</span>
            </div>
            <p className="m-0 mt-1 text-xs text-text-muted">Отфильтруйте людей перед назначением — таблица останется компактной.</p>
          </div>
        </div>
        {hasFilters && <button type="button" className="min-h-9 rounded-lg border border-line px-2.5 text-xs font-bold text-text-secondary transition hover:border-line-strong hover:text-text-primary" onClick={onReset}>Сбросить фильтры</button>}
      </div>
      <div className="grid min-w-0 gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
        <label className="grid min-w-0 gap-1 text-[11px] font-extrabold uppercase tracking-[0.07em] text-text-muted">
          <span>Поиск человека</span>
          <span className="relative block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={17} aria-hidden="true" />
            <input className="min-h-10.5 w-full rounded-xl border border-line bg-bg-raised pl-9 pr-3 text-sm font-semibold normal-case tracking-normal text-text-primary outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/15" value={personQuery} onChange={(event) => onPersonQuery(event.target.value)} placeholder="ФИО, звание или номер" aria-label="Поиск по ФИО, званию или номеру" />
          </span>
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] font-extrabold uppercase tracking-[0.07em] text-text-muted">
          <span>Подразделение</span>
          <SelectField ariaLabel="Фильтр по подразделению" value={platoonFilter} options={platoonOptions} onChange={onPlatoonFilter} />
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] font-extrabold uppercase tracking-[0.07em] text-text-muted">
          <span>Группа</span>
          <SelectField ariaLabel="Фильтр по группе" value={groupFilter} options={groupOptions} onChange={onGroupFilter} />
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] font-extrabold uppercase tracking-[0.07em] text-text-muted">
          <span>Статус</span>
          <SelectField ariaLabel="Фильтр по статусу назначения" value={personView} options={statusOptions} onChange={onPersonView} />
        </label>
      </div>
    </section>
  );
}

function ScheduleMatrix({
  snapshot,
  peopleByPlatoon,
  visiblePeopleCount,
  assignmentMap,
  groupMap,
  groupToneMap,
  canWrite,
  onCell,
}: {
  snapshot: ScheduleSnapshot;
  peopleByPlatoon: Array<{ id: string; label: string; people: ScheduleSnapshot["people"] }>;
  visiblePeopleCount: number;
  assignmentMap: Map<string, GroupAssignment[]>;
  groupMap: Map<string, ScheduleSnapshot["groups"][number]>;
  groupToneMap: Map<string, string>;
  canWrite: boolean;
  onCell: (personId: string, date: string) => void;
}) {
  return (
    <section className="schedule-table-shell min-w-0 overflow-hidden rounded-[20px] border border-line bg-bg-panel shadow-(--shadow)" aria-label="Таблица графика нарядов">
      {visiblePeopleCount > 0 ? <>
        <div className="schedule-table-scroll overflow-auto max-[480px]:hidden">
          <table className="schedule-table w-full min-w-190 border-collapse text-left">
          <thead>
            <tr className="bg-white/4.5 text-text-muted">
              <th className="schedule-sticky schedule-number-cell border-b border-line px-2.5 py-2 text-center text-[11px] font-bold" scope="col">№</th>
              <th className="schedule-sticky schedule-person-cell border-b border-line px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em]" scope="col">ФИО / звание</th>
              {snapshot.dates.map((date) => <th className="min-w-22 border-b border-line border-l px-2 py-2 text-center" key={date} scope="col"><span className="block font-mono text-[13px] font-extrabold text-text-primary">{scheduleDateLabel(date)}</span><span className="mt-0.5 block text-[10px] font-bold uppercase text-text-muted">{scheduleDayLabel(date)}</span></th>)}
            </tr>
          </thead>
          {peopleByPlatoon.map((section) => <tbody key={section.id}>
            <tr className="schedule-section-row">
              <th className="border-b border-line-strong bg-[color-mix(in_oklch,var(--cyan)_9%,var(--bg-raised))] px-3 py-2 text-xs font-extrabold text-cyan" colSpan={snapshot.dates.length + 2} scope="rowgroup">{section.label}<span className="ml-2 font-mono text-[10px] font-bold text-text-muted">{section.people.length} {pluralPeople(section.people.length)}</span></th>
            </tr>
            {section.people.map((person, index) => <tr className="group border-b border-line/70 last:border-b-0 hover:bg-white/2.5" key={person.id}>
              <td className="schedule-sticky schedule-number-cell bg-bg-panel px-2.5 py-2 text-center font-mono text-[11px] text-text-muted">{index + 1}</td>
              <td className="schedule-sticky schedule-person-cell bg-bg-panel px-3 py-2"><span className="block max-w-56 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-text-primary" title={person.name}>{person.name}</span><span className="mt-0.5 block max-w-56 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-text-muted" title={person.rank}>{person.rank}</span></td>
              {snapshot.dates.map((date) => {
                const assignments = assignmentMap.get(`${person.id}\u0000${date}`) ?? assignmentsForCell(snapshot.assignments, person.id, date);
                return <td className={`min-w-22 border-l border-line px-1.5 py-1.5 align-middle ${canWrite ? "cursor-pointer hover:bg-accent-soft/35 focus-within:bg-accent-soft/35" : ""}`} key={date} onClick={() => canWrite && onCell(person.id, date)} onKeyDown={(event) => { if (canWrite && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onCell(person.id, date); } }} role={canWrite ? "button" : undefined} tabIndex={canWrite ? 0 : undefined} aria-label={canWrite ? `Редактировать ${person.name}, ${scheduleDateLabel(date)}` : undefined} title={canWrite ? "Открыть редактор назначений" : undefined}>
                  <AssignmentChips assignments={assignments} groupMap={groupMap} groupToneMap={groupToneMap} />
                </td>;
              })}
            </tr>)}
          </tbody>)}
          </table>
        </div>
        <ScheduleCards snapshot={snapshot} peopleByPlatoon={peopleByPlatoon} assignmentMap={assignmentMap} groupMap={groupMap} groupToneMap={groupToneMap} canWrite={canWrite} onCell={onCell} />
      </> : snapshot.people.length > 0 ? <div className="grid min-h-48 place-items-center gap-1.5 p-6 text-center text-text-muted"><strong className="text-text-secondary">Никого не найдено</strong><span className="max-w-[42ch] text-sm">Измените поиск или фильтры, чтобы увидеть людей в графике.</span></div> : <div className="grid min-h-48 place-items-center gap-1.5 p-6 text-center text-text-muted"><strong className="text-text-secondary">Личный состав не найден</strong><span className="text-sm">Добавьте людей в разделе «Справочники».</span></div>}
    </section>
  );
}

function AssignmentChips({
  assignments,
  groupMap,
  groupToneMap,
  emptyLabel = "·",
}: {
  assignments: GroupAssignment[];
  groupMap: Map<string, ScheduleSnapshot["groups"][number]>;
  groupToneMap: Map<string, string>;
  emptyLabel?: string;
}) {
  if (!assignments.length) return <span className="block text-center font-mono text-[11px] text-text-muted/60">{emptyLabel}</span>;
  return <div className="grid gap-1">{assignments.map((assignment) => {
    const group = groupMap.get(assignment.groupId);
    const hasConflict = assignment.conflictState === "warning";
    return <span className={`inline-flex min-h-7 items-center justify-center rounded-md border px-1.5 py-1 text-center font-mono text-[10px] font-extrabold leading-tight ${hasConflict ? "border-amber/55 bg-amber/18 text-amber" : groupToneMap.get(assignment.groupId) ?? "border-line bg-white/5 text-text-secondary"}`} key={assignment.id} title={`${group?.name ?? assignment.groupId}${hasConflict ? ". Конфликт назначений." : ""}`}>{hasConflict && <WarningIcon className="mr-1 shrink-0" size={12} aria-label="Конфликт" />}{compactDutyLabel(group?.name ?? assignment.groupId)}</span>;
  })}</div>;
}

function ScheduleCards({
  snapshot,
  peopleByPlatoon,
  assignmentMap,
  groupMap,
  groupToneMap,
  canWrite,
  onCell,
}: {
  snapshot: ScheduleSnapshot;
  peopleByPlatoon: Array<{ id: string; label: string; people: ScheduleSnapshot["people"] }>;
  assignmentMap: Map<string, GroupAssignment[]>;
  groupMap: Map<string, ScheduleSnapshot["groups"][number]>;
  groupToneMap: Map<string, string>;
  canWrite: boolean;
  onCell: (personId: string, date: string) => void;
}) {
  return <div className="hidden gap-2.5 p-2.5 max-[480px]:grid" aria-label="Вертикальный график">
    {peopleByPlatoon.map((section) => <section className="grid gap-2" key={section.id}>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-line-strong bg-accent-soft/35 px-3 py-2"><h3 className="m-0 text-xs font-extrabold text-cyan">{section.label}</h3><span className="font-mono text-[10px] font-bold text-text-muted">{section.people.length} {pluralPeople(section.people.length)}</span></div>
      {section.people.map((person) => <article className="grid gap-2 rounded-2xl border border-line bg-bg-raised/70 p-2.5" key={person.id}>
        <header className="flex min-w-0 items-center justify-between gap-2 border-b border-line pb-2">
          <div className="min-w-0"><h4 className="m-0 truncate text-sm font-extrabold text-text-primary" title={person.name}>{person.name}</h4><p className="m-0 mt-0.5 truncate text-xs text-text-muted" title={person.rank}>{person.rank}</p></div>
          <span className="shrink-0 rounded-full border border-line bg-white/4 px-2 py-1 text-[10px] font-bold text-text-muted">{snapshot.dates.reduce((total, date) => total + (assignmentMap.get(`${person.id}\u0000${date}`)?.length ?? 0), 0)} назнач.</span>
        </header>
        <div className="grid gap-1.5">
          {snapshot.dates.map((date) => {
            const assignments = assignmentMap.get(`${person.id}\u0000${date}`) ?? assignmentsForCell(snapshot.assignments, person.id, date);
            const content = <><span className="grid min-w-16 content-center text-left"><strong className="font-mono text-xs text-text-primary">{scheduleDateLabel(date)}</strong><small className="mt-0.5 text-[10px] font-bold uppercase text-text-muted">{scheduleDayLabel(date)}</small></span><div className="min-w-0"><AssignmentChips assignments={assignments} groupMap={groupMap} groupToneMap={groupToneMap} emptyLabel="Свободно" /></div></>;
            return canWrite ? <button type="button" className="grid min-h-12 w-full grid-cols-[minmax(64px,78px)_minmax(0,1fr)] items-center gap-2 rounded-xl border border-line bg-bg-panel px-2.5 py-1.5 text-left transition hover:border-accent-line hover:bg-accent-soft/25" key={date} onClick={() => onCell(person.id, date)} aria-label={`Редактировать ${person.name}, ${scheduleDateLabel(date)}`} title="Открыть редактор назначений">{content}</button> : <div className="grid min-h-12 grid-cols-[minmax(64px,78px)_minmax(0,1fr)] items-center gap-2 rounded-xl border border-line bg-bg-panel px-2.5 py-1.5 text-left" key={date}>{content}</div>;
          })}
        </div>
      </article>)}
    </section>)}
  </div>;
}

function AssignmentEditor({
  selectedPerson,
  cellTarget,
  selectedAssignments,
  groups,
  groupMap,
  groupRules,
  editorGroupId,
  selectedGroupAlreadyAssigned,
  pending,
  error,
  notice,
  onGroupChange,
  onClose,
  onAssign,
  onRemove,
}: {
  selectedPerson: ScheduleSnapshot["people"][number];
  cellTarget: NonNullable<CellTarget>;
  selectedAssignments: GroupAssignment[];
  groups: ScheduleSnapshot["groups"];
  groupMap: Map<string, ScheduleSnapshot["groups"][number]>;
  groupRules: Record<string, GroupRule>;
  editorGroupId: string;
  selectedGroupAlreadyAssigned: boolean;
  pending: boolean;
  error: string | null;
  notice: string | null;
  onGroupChange: (value: string) => void;
  onClose: () => void;
  onAssign: () => void;
  onRemove: (assignment: GroupAssignment) => void;
}) {
  const selectedRule = groupRules[editorGroupId];
  const groupOptions = groups.map((group) => ({ value: group.id, label: group.name }));
  const helperText = selectedGroupAlreadyAssigned
    ? "Эта группа уже есть у человека в выбранную дату."
    : selectedRule?.overlapPolicy === "manual"
      ? "Для этой группы разрешено ручное совмещение."
      : "Строгая группа блокирует пересечение с другим назначением.";
  const assignmentState = scheduleAssignmentState(selectedAssignments);
  const statusMeta = pending
    ? { label: "Обновление…", className: "border-cyan/35 bg-cyan/10 text-cyan" }
    : {
      empty: { label: "Нет назначений", className: "border-line bg-bg-panel/70 text-text-secondary" },
      clear: { label: "Без конфликтов", className: "border-green/30 bg-green/8 text-green" },
      allowed: { label: "Совмещение разрешено", className: "border-cyan/35 bg-cyan/10 text-cyan" },
      warning: { label: "Есть конфликт", className: "border-amber/45 bg-amber/10 text-amber" },
    }[assignmentState];

  return <div className="fixed inset-0 z-50 grid min-h-full place-items-end bg-black/65 p-3 backdrop-blur-sm sm:place-items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside id="schedule-assignment-editor" className="grid max-h-[min(90dvh,720px)] w-full max-w-[560px] gap-3 overflow-y-auto rounded-[24px] border border-accent-line bg-[oklch(14%_0.04_286/0.98)] p-4 shadow-[0_24px_80px_rgb(0_0_0/0.5)]" role="dialog" aria-modal="true" aria-labelledby="schedule-assignment-editor-title">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-cyan">Выбрано</span><h2 id="schedule-assignment-editor-title" className="m-0 mt-1 truncate text-base font-extrabold" title={selectedPerson.name}>{selectedPerson.name}</h2><p className="m-0 mt-1 text-sm text-text-secondary">{selectedPerson.rank} · {scheduleDateLabel(cellTarget.date)}, {scheduleDayLabel(cellTarget.date)}</p></div><button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-text-muted transition hover:border-line-strong hover:text-text-primary" onClick={onClose} aria-label="Закрыть редактор"><XIcon size={17} /></button></div>
    {error && <div className="rounded-xl border border-red/35 bg-red/10 px-3 py-2.5 text-sm leading-5 text-red" role="alert">{error}</div>}
    {notice && <div className="rounded-xl border border-green/30 bg-green/10 px-3 py-2.5 text-sm leading-5 text-green" role="status">{notice}</div>}
    <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-line bg-bg-panel/70 p-2.5"><span className="block text-[10px] font-bold uppercase tracking-[0.07em] text-text-muted">Назначений</span><strong className="mt-1 block font-mono text-xl text-text-primary">{selectedAssignments.length}</strong></div><div className={`rounded-xl border p-2.5 ${statusMeta.className}`}><span className="block text-[10px] font-bold uppercase tracking-[0.07em] text-text-muted">Состояние</span><strong className="mt-1 block text-sm">{statusMeta.label}</strong></div></div>
    <div className="grid gap-2"><label className="grid gap-1 text-xs font-bold text-text-secondary"><span>Добавить группу</span><SelectField ariaLabel="Группа назначения" value={editorGroupId} options={groupOptions} onChange={onGroupChange} disabled={pending} /></label><p className={`m-0 text-xs leading-5 ${selectedGroupAlreadyAssigned ? "text-amber" : "text-text-muted"}`}>{helperText}</p><button type="button" className="min-h-10.5 rounded-[11px] border border-accent bg-accent px-4 text-sm font-extrabold text-[oklch(12%_0.04_286)] transition hover:brightness-110 disabled:opacity-55" disabled={pending || !editorGroupId || selectedGroupAlreadyAssigned} onClick={onAssign}>Назначить вручную</button></div>
    <div className="grid gap-1.5"><span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Назначено на дату</span>{selectedAssignments.length > 0 ? selectedAssignments.map((assignment) => <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg-panel px-3 py-2" key={assignment.id}><span className="min-w-0 truncate text-sm font-bold" title={groupMap.get(assignment.groupId)?.name ?? assignment.groupId}>{groupMap.get(assignment.groupId)?.name ?? assignment.groupId} <small className="font-normal text-text-muted">({assignment.source === "manual" ? "вручную" : "авто"})</small></span><button type="button" className="min-h-8 shrink-0 rounded-lg border border-red/35 px-2.5 text-xs font-bold text-red transition hover:bg-red/10 disabled:opacity-55" disabled={pending} onClick={() => onRemove(assignment)}>Снять</button></div>) : <p className="m-0 rounded-xl border border-dashed border-line p-3 text-sm text-text-muted">На эту дату назначений пока нет.</p>}</div>
    <p className="m-0 border-t border-line pt-3 text-xs leading-5 text-text-muted">Автоматическая ротация не удаляет ручные назначения. Конфликт строгих групп требует выбрать другую дату или группу.</p>
    </aside>
  </div>;
}

function YearSummary({ snapshot, months, onDrill }: { snapshot: ScheduleSnapshot; months: string[]; onDrill: (month: string) => void }) {
  const groupMap = groupById(snapshot.groups);
  return <section className="grid gap-3 rounded-[20px] border border-line bg-bg-panel p-4" aria-label="Обзор графика по месяцам">
    <div><h2 className="m-0 text-base font-extrabold">Обзор периода</h2><p className="m-0 mt-1 text-sm text-text-secondary">Годовой диапазон показан компактно. Нажмите месяц для подробной матрицы.</p></div>
    <div className="overflow-auto max-[480px]:hidden"><table className="min-w-full border-collapse text-left"><thead><tr className="border-b border-line text-xs text-text-muted"><th className="px-2 py-2">Группа</th>{months.map((month) => <th className="min-w-28 px-2 py-2 text-center" key={month}><button type="button" className="font-bold text-cyan hover:underline" onClick={() => onDrill(month)}>{scheduleMonthLabel(month)}</button></th>)}</tr></thead><tbody>{snapshot.groups.map((group) => <tr className="border-b border-line/70" key={group.id}><th className="px-2 py-2 text-sm font-bold">{groupMap.get(group.id)?.name}</th>{months.map((month) => { const assignments = snapshot.assignments.filter((assignment) => assignment.groupId === group.id && scheduleMonthKey(assignment.assignedDate) === month); const conflicts = assignments.filter((assignment) => assignment.conflictState === "warning").length; return <td className="px-2 py-2 text-center" key={month}><button type="button" className={`inline-flex min-w-18 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 font-mono text-sm font-bold ${conflicts ? "border-amber/55 bg-amber/12 text-amber" : "border-line bg-white/4 text-text-primary"}`} onClick={() => onDrill(month)}>{assignments.length}{conflicts ? <><WarningIcon size={13} aria-label="Конфликты" /><small className="text-[10px]">{conflicts}</small></> : null}</button></td>; })}</tr>)}</tbody></table></div>
    <div className="hidden gap-2 max-[480px]:grid">{months.map((month) => <article className="grid gap-2 rounded-2xl border border-line bg-bg-raised/70 p-2.5" key={month}><button type="button" className="flex min-h-11 items-center justify-between rounded-xl border border-accent-line bg-accent-soft/25 px-3 text-left font-bold text-cyan" onClick={() => onDrill(month)}><span>{scheduleMonthLabel(month)}</span><span aria-hidden="true">Открыть →</span></button><div className="grid gap-1.5">{snapshot.groups.map((group) => { const assignments = snapshot.assignments.filter((assignment) => assignment.groupId === group.id && scheduleMonthKey(assignment.assignedDate) === month); const conflicts = assignments.filter((assignment) => assignment.conflictState === "warning").length; return <button type="button" className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 text-left ${conflicts ? "border-amber/55 bg-amber/12" : "border-line bg-bg-panel"}`} key={group.id} onClick={() => onDrill(month)}><span className="min-w-0 truncate text-sm font-bold text-text-primary">{groupMap.get(group.id)?.name}</span><span className={`inline-flex shrink-0 items-center gap-1 font-mono text-sm font-bold ${conflicts ? "text-amber" : "text-text-secondary"}`}>{assignments.length}{conflicts ? <><WarningIcon size={13} aria-label="Конфликты" /><small className="text-[10px]">{conflicts}</small></> : null}</span></button>; })}</div></article>)}</div>
  </section>;
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: "amber" | "green" }) { return <div className="grid min-w-0 gap-1 rounded-[14px] border border-white/10 bg-white/5 p-2.5"><span className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">{label}</span><b className={`font-mono text-2xl leading-none ${tone === "amber" ? "text-amber" : tone === "green" ? "text-green" : "text-text-primary"}`}>{value}</b></div>; }

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid min-w-34 gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">{label}<input className="min-h-10.5 rounded-[11px] border border-line bg-black/15 px-2.5 text-sm font-semibold text-text-primary outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/15" type="date" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
