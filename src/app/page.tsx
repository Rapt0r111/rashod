import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { getPostgresSnapshot as getSnapshot } from "@/server/db/postgres-roster-repository";
import { hasPermission } from "@/features/auth/permissions";
import { WorkspaceApp } from "@/features/WorkspaceApp";
import { getPostgresGroupsSnapshot } from "@/server/db/postgres-groups-repository";
import { getPostgresTasksSnapshot } from "@/server/db/postgres-tasks-repository";
import { hasZgtAccess } from "@/features/portal/modules";
import { getCachedHasUsers } from "@/server/cache/stable-data";
import { getRequestAuth } from "@/server/auth/request-auth";
import { PageFallback } from "@/components/page-fallback";

/**
 * Расход — отдельный operator surface (свой TopBar).
 * Портал/ЗГТ живут в (modules) layout с общим portal chrome.
 * Live roster data is never cached.
 */
export default function Home() {
  return (
    <Suspense fallback={<PageFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const context = await getRequestAuth();
  if (!context) return <LoginScreen setupRequired={!(await getCachedHasUsers())} />;
  if (hasPermission(context, "roster:read")) {
    const snapshot = await getSnapshot();
    return (
      <WorkspaceApp
        mode="roster"
        initialSnapshot={snapshot}
        permissions={context.permissions}
      />
    );
  }
  if (hasPermission(context, "groups:read")) {
    return (
      <WorkspaceApp
        mode="groups"
        initialSnapshot={await getPostgresGroupsSnapshot()}
        canWrite={hasPermission(context, "groups:write")}
      />
    );
  }
  if (hasPermission(context, "tasks:read")) {
    return (
      <WorkspaceApp
        mode="tasks"
        initialSnapshot={await getPostgresTasksSnapshot()}
        canWrite={hasPermission(context, "tasks:write")}
      />
    );
  }
  if (hasZgtAccess(context.permissions)) redirect("/zgt");
  return (
    <main className="grid min-h-dvh place-items-center bg-bg-base p-6 text-text-primary">
      <p className="rounded-xl border border-line bg-bg-panel p-5">
        Доступ к рабочим данным не выдан.
      </p>
    </main>
  );
}
