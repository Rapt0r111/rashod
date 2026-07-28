import { cookies } from "next/headers";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { getPostgresSnapshot as getSnapshot } from "@/server/db/postgres-roster-repository";
import { getAuthContextByToken, hasUsers } from "@/server/auth";
import { hasPermission } from "@/features/auth/permissions";
import { WorkspaceApp } from "@/features/WorkspaceApp";
import { getPostgresGroupsSnapshot } from "@/server/db/postgres-groups-repository";
import { getPostgresTasksSnapshot } from "@/server/db/postgres-tasks-repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const token = (await cookies()).get("rashod_session")?.value;
  const context = await getAuthContextByToken(token);
  if (!context) return <LoginScreen setupRequired={!(await hasUsers())} />;
  if (hasPermission(context, "roster:read")) {
    const snapshot = await getSnapshot();
    return <WorkspaceApp mode="roster" initialSnapshot={snapshot} permissions={context.permissions} />;
  }
  if (hasPermission(context, "groups:read")) {
    return <WorkspaceApp mode="groups" initialSnapshot={await getPostgresGroupsSnapshot()} canWrite={hasPermission(context, "groups:write")} />;
  }
  if (hasPermission(context, "tasks:read")) {
    return <WorkspaceApp mode="tasks" initialSnapshot={await getPostgresTasksSnapshot()} canWrite={hasPermission(context, "tasks:write")} />;
  }
  return <main className="min-h-dvh grid place-items-center bg-bg-base p-6 text-text-primary"><p className="rounded-xl border border-line bg-bg-panel p-5">Доступ к рабочим данным не выдан.</p></main>;
}
