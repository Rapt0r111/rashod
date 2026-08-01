"use client";

import {
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  DownloadSimpleIcon,
  PrinterIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { useRealtimeDomain } from "@/features/realtime/RealtimeProvider";
import { fetchScheduleSnapshot } from "./api";
import { exportScheduleCsv, buildScheduleCsv } from "./csv";
import {
  assignmentsForCell,
  compactDutyLabel,
  groupById,
  scheduleDateLabel,
  scheduleDateRange,
  scheduleDayLabel,
} from "./logic";
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

export function ScheduleApp({
  initialSnapshot,
  onOpenGroups,
  onSnapshotChange,
}: {
  initialSnapshot: ScheduleSnapshot;
  onOpenGroups: () => void;
  onSnapshotChange?: (snapshot: ScheduleSnapshot) => void;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [from, setFrom] = useState(initialSnapshot.from);
  const [to, setTo] = useState(initialSnapshot.to);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchScheduleSnapshot(snapshot.from, snapshot.to);
      setSnapshot(next);
      onSnapshotChange?.(next);
      setError(null);
    } catch {
      setError("Не удалось обновить график. Проверьте соединение и повторите попытку.");
    }
  }, [onSnapshotChange, snapshot.from, snapshot.to]);

  useRealtimeDomain(["groups", "roster", "unknown"], () => {
    void refresh();
  });

  const groupMap = useMemo(() => groupById(snapshot.groups), [snapshot.groups]);
  const groupToneMap = useMemo(
    () => new Map(snapshot.groups.map((group, index) => [group.id, toneFor(index)])),
    [snapshot.groups],
  );
  const assignmentMap = useMemo(() => {
    const map = new Map<string, ScheduleSnapshot["assignments"]>();
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

  async function applyRange() {
    if (!scheduleDateRange(from, to) || pending) {
      setError("Выберите корректный диапазон до 31 дня.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = await fetchScheduleSnapshot(from, to);
      setSnapshot(next);
      onSnapshotChange?.(next);
    } catch {
      setError("Не удалось загрузить выбранный диапазон графика.");
    } finally {
      setPending(false);
    }
  }

  function showToday() {
    const today = new Date();
    const value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setFrom(value);
    setTo(value);
  }

  const rowsCount = snapshot.people.length;
  const conflictsCount = snapshot.assignments.filter((assignment) => assignment.conflictState === "warning").length;

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
              Матрица назначений по личному составу. Нажмите «Группы», чтобы изменить правила или назначение.
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
          <button type="button" className="min-h-10.5 rounded-[11px] border border-line bg-white/5 px-3.5 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary" onClick={showToday}>
            Сегодня
          </button>
          <span className="flex-1" />
          <button type="button" className="min-h-10.5 rounded-[11px] border border-line bg-white/5 px-3.5 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary" onClick={onOpenGroups}>
            Группы
          </button>
          <button type="button" className="inline-flex min-h-10.5 items-center gap-2 rounded-[11px] border border-line bg-white/5 px-3.5 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary" onClick={() => window.print()}>
            <PrinterIcon size={17} aria-hidden="true" /> Печать
          </button>
          <button type="button" className="inline-flex min-h-10.5 items-center gap-2 rounded-[11px] border border-line bg-white/5 px-3.5 text-sm font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary" onClick={() => exportScheduleCsv(buildScheduleCsv(snapshot), snapshot.from, snapshot.to)}>
            <DownloadSimpleIcon size={17} aria-hidden="true" /> CSV
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red/35 bg-red/8 px-3.5 py-3 text-sm text-red" role="alert">
          <span>{error}</span>
          <button type="button" className="inline-flex min-h-8.5 items-center gap-1.5 rounded-lg border border-red/35 px-2.5 text-xs font-bold" onClick={() => void refresh()}>
            <ArrowsClockwiseIcon size={15} /> Повторить
          </button>
        </div>
      )}

      <div className="schedule-legend flex min-w-0 flex-wrap items-center gap-2 rounded-[18px] border border-line bg-bg-panel px-3.5 py-3">
        <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Наряды</span>
        {snapshot.groups.map((group, index) => (
          <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${toneFor(index)}`} key={group.id} title={group.name}>
            <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
            <span className="max-w-48 overflow-hidden text-ellipsis whitespace-nowrap">{compactDutyLabel(group.name)} · {group.name}</span>
          </span>
        ))}
        {!snapshot.groups.length && <span className="text-sm text-text-muted">Группы нарядов ещё не созданы.</span>}
      </div>

      <section className="schedule-table-shell min-w-0 overflow-hidden rounded-[20px] border border-line bg-bg-panel shadow-(--shadow)" aria-label="Таблица графика нарядов">
        <div className="schedule-table-scroll overflow-auto">
          <table className="schedule-table min-w-190 border-collapse text-left">
            <thead>
              <tr className="bg-white/4.5 text-text-muted">
                <th className="schedule-sticky schedule-number-cell border-b border-line px-2.5 py-2 text-center text-[11px] font-bold" scope="col">№</th>
                <th className="schedule-sticky schedule-person-cell border-b border-line px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em]" scope="col">ФИО / звание</th>
                {snapshot.dates.map((date) => (
                  <th className="min-w-22 border-b border-line border-l px-2 py-2 text-center" key={date} scope="col">
                    <span className="block font-mono text-[13px] font-extrabold text-text-primary">{scheduleDateLabel(date)}</span>
                    <span className="mt-0.5 block text-[10px] font-bold uppercase text-text-muted">{scheduleDayLabel(date)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            {peopleByPlatoon.map((section) => (
              <tbody key={section.id}>
                <tr className="schedule-section-row">
                  <th className="border-b border-line-strong bg-[color-mix(in_oklch,var(--cyan)_9%,var(--bg-raised))] px-3 py-2 text-xs font-extrabold text-cyan" colSpan={snapshot.dates.length + 2} scope="rowgroup">
                    <span>{section.label}</span>
                    <span className="ml-2 font-mono text-[10px] font-bold text-text-muted">{section.people.length} {pluralPeople(section.people.length)}</span>
                  </th>
                </tr>
                {section.people.map((person, index) => (
                  <tr className="group border-b border-line/70 last:border-b-0 hover:bg-white/2.5" key={person.id}>
                    <td className="schedule-sticky schedule-number-cell bg-bg-panel px-2.5 py-2 text-center font-mono text-[11px] text-text-muted">{index + 1}</td>
                    <td className="schedule-sticky schedule-person-cell bg-bg-panel px-3 py-2">
                      <span className="block max-w-56 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-text-primary" title={person.name}>{person.name}</span>
                      <span className="mt-0.5 block max-w-56 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-text-muted" title={person.rank}>{person.rank}</span>
                    </td>
                    {snapshot.dates.map((date) => {
                      const assignments = assignmentMap.get(`${person.id}\u0000${date}`) ?? assignmentsForCell(snapshot.assignments, person.id, date);
                      return (
                        <td className="min-w-22 border-l border-line px-1.5 py-1.5 align-middle" key={date}>
                          {assignments.length ? (
                            <div className="grid gap-1">
                              {assignments.map((assignment) => {
                                const group = groupMap.get(assignment.groupId);
                                const hasConflict = assignment.conflictState === "warning";
                                return (
                                  <span className={`inline-flex min-h-7 items-center justify-center rounded-md border px-1.5 py-1 text-center font-mono text-[10px] font-extrabold leading-tight ${hasConflict ? "border-amber/55 bg-amber/18 text-amber" : groupToneMap.get(assignment.groupId) ?? "border-line bg-white/5 text-text-secondary"}`} key={assignment.id} title={`${group?.name ?? assignment.groupId}${hasConflict ? ". Конфликт назначений." : ""}`}>
                                    {hasConflict && <WarningIcon className="mr-1 shrink-0" size={12} aria-label="Конфликт" />}
                                    {compactDutyLabel(group?.name ?? assignment.groupId)}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="block text-center font-mono text-[11px] text-text-muted/60">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        {!snapshot.people.length && (
          <div className="grid min-h-48 place-items-center gap-1.5 p-6 text-center text-text-muted">
            <strong className="text-text-secondary">Личный состав не найден</strong>
            <span className="text-sm">Добавьте людей в разделе «Справочники».</span>
          </div>
        )}
      </section>
      <p className="schedule-print-note m-0 text-xs text-text-muted">Период: {snapshot.from} — {snapshot.to}. Обновляется автоматически после изменений в группах.</p>
    </section>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: "amber" | "green" }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-[14px] border border-white/10 bg-white/5 p-2.5">
      <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">{label}</span>
      <b className={`font-mono text-2xl leading-none ${tone === "amber" ? "text-amber" : tone === "green" ? "text-green" : "text-text-primary"}`}>{value}</b>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid min-w-34 gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
      {label}
      <input className="min-h-10.5 rounded-[11px] border border-line bg-black/15 px-2.5 text-sm font-semibold text-text-primary outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/15" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
