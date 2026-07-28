"use client";

import dynamic from "next/dynamic";
import type { Permission } from "./auth/permissions";
import { RosterApp } from "./roster/RosterApp";
import type { Snapshot } from "./roster/types";
import type { GroupsSnapshot } from "./groups/types";
import type { TasksSnapshot } from "./tasks/types";
import { Loader } from "@/components/loader";

const GroupsApp = dynamic(
  () => import("./groups/GroupsApp").then((module) => module.GroupsApp),
  { loading: () => <WorkspaceLoading /> },
);
const TasksApp = dynamic(
  () => import("./tasks/TasksApp").then((module) => module.TasksApp),
  { loading: () => <WorkspaceLoading /> },
);

type WorkspaceProps =
  | { mode: "roster"; initialSnapshot: Snapshot; permissions: Permission[] }
  | { mode: "groups"; initialSnapshot: GroupsSnapshot; canWrite: boolean }
  | { mode: "tasks"; initialSnapshot: TasksSnapshot; canWrite: boolean };

export function WorkspaceApp(props: WorkspaceProps) {
  if (props.mode === "roster") {
    return <RosterApp initialSnapshot={props.initialSnapshot} permissions={props.permissions} />;
  }
  if (props.mode === "groups") {
    return (
      <main className="h-dvh min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-bg-base">
        <GroupsApp initialSnapshot={props.initialSnapshot} canWrite={props.canWrite} />
      </main>
    );
  }
  return <TasksApp initialSnapshot={props.initialSnapshot} canWrite={props.canWrite} />;
}

function WorkspaceLoading() {
  return (
    <div className="grid min-h-55 place-items-center text-text-muted">
      <Loader />
    </div>
  );
}
