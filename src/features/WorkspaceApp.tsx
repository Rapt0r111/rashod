"use client";

import dynamic from "next/dynamic";
import type { Permission } from "./auth/permissions";
import { RosterApp } from "./roster/RosterApp";
import type { Snapshot } from "./roster/types";
import type { GroupsSnapshot } from "./groups/types";
import type { TasksSnapshot } from "./tasks/types";
import { Loader } from "@/components/loader";
import { RealtimeProvider } from "@/features/realtime/RealtimeProvider";
import { useState } from "react";
import { fetchScheduleSnapshot } from "./schedule/api";
import type { ScheduleSnapshot } from "./schedule/types";

// Prefer data-fetch loading over a second dynamic() spinner flash.
const GroupsApp = dynamic(
  () => import("./groups/GroupsApp").then((module) => module.GroupsApp),
  { loading: () => null },
);
const TasksApp = dynamic(
  () => import("./tasks/TasksApp").then((module) => module.TasksApp),
  { loading: () => null },
);
const ScheduleApp = dynamic(
  () => import("./schedule/ScheduleApp").then((module) => module.ScheduleApp),
  { loading: () => null },
);

type WorkspaceProps =
  | { mode: "roster"; initialSnapshot: Snapshot; permissions: Permission[] }
  | { mode: "groups"; initialSnapshot: GroupsSnapshot; canWrite: boolean }
  | { mode: "tasks"; initialSnapshot: TasksSnapshot; canWrite: boolean };

export function WorkspaceApp(props: WorkspaceProps) {
  return (
    <RealtimeProvider>
      <WorkspaceBody {...props} />
    </RealtimeProvider>
  );
}

function WorkspaceBody(props: WorkspaceProps) {
  if (props.mode === "roster") {
    return <RosterApp initialSnapshot={props.initialSnapshot} permissions={props.permissions} />;
  }
  if (props.mode === "groups") {
    return <GroupsWorkspace initialSnapshot={props.initialSnapshot} canWrite={props.canWrite} />;
  }
  return <TasksApp initialSnapshot={props.initialSnapshot} canWrite={props.canWrite} />;
}

function GroupsWorkspace({ initialSnapshot, canWrite }: { initialSnapshot: GroupsSnapshot; canWrite: boolean }) {
  const [view, setView] = useState<"groups" | "schedule">("groups");
  const [scheduleSnapshot, setScheduleSnapshot] = useState<ScheduleSnapshot | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  async function openSchedule() {
    setView("schedule");
    if (scheduleSnapshot || loadingSchedule) return;
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      setScheduleSnapshot(await fetchScheduleSnapshot());
    } catch {
      setScheduleError("Не удалось загрузить график.");
    } finally {
      setLoadingSchedule(false);
    }
  }

  return (
    <main className="h-dvh min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-bg-base">
      <nav className="sticky top-0 z-20 flex gap-2 border-b border-line bg-bg-base/95 px-3 py-2 backdrop-blur md:px-4" aria-label="Разделы групп">
        <button
          type="button"
          className={`inline-flex min-h-[42px] items-center rounded-[13px] border px-3 text-sm font-semibold transition-[background-color,border-color,color] duration-150 ${view === "groups" ? "border-accent-line bg-accent-soft text-text-primary" : "border-line text-text-secondary hover:border-line-strong hover:text-text-primary"}`}
          onClick={() => setView("groups")}
        >
          Группы
        </button>
        <button
          type="button"
          className={`inline-flex min-h-[42px] items-center rounded-[13px] border px-3 text-sm font-semibold transition-[background-color,border-color,color] duration-150 ${view === "schedule" ? "border-accent-line bg-accent-soft text-text-primary" : "border-line text-text-secondary hover:border-line-strong hover:text-text-primary"}`}
          onClick={() => void openSchedule()}
        >
          График
        </button>
      </nav>
      {view === "groups" ? (
        <GroupsApp initialSnapshot={initialSnapshot} canWrite={canWrite} />
      ) : loadingSchedule ? (
        <WorkspaceLoading />
      ) : scheduleSnapshot ? (
        <ScheduleApp
          initialSnapshot={scheduleSnapshot}
          canWrite={canWrite}
          onOpenGroups={() => setView("groups")}
          onSnapshotChange={setScheduleSnapshot}
        />
      ) : (
        <div className="grid min-h-55 place-items-center gap-3 p-5 text-center text-sm text-red">
          <span>{scheduleError ?? "Не удалось загрузить график."}</span>
          <button
            type="button"
            className="inline-flex min-h-[42px] items-center rounded-[10px] border border-accent-line bg-accent-soft px-4 font-semibold text-text-primary"
            onClick={() => void openSchedule()}
          >
            Повторить
          </button>
        </div>
      )}
    </main>
  );
}

function WorkspaceLoading() {
  return (
    <div className="grid min-h-55 place-items-center text-text-muted">
      <Loader />
    </div>
  );
}
