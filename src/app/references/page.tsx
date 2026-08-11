import { cookies } from "next/headers";
import Link from "next/link";
import { DynamicPage } from "@/components/dynamic-page";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { hasPermission } from "@/features/auth/permissions";
import { ReferencesApp } from "@/features/roster/ReferencesApp";
import { getPostgresSnapshot } from "@/server/db/postgres-roster-repository";
import { getAuthContextByToken } from "@/server/auth";
import { getCachedHasUsers } from "@/server/cache/stable-data";

export default function ReferencesPage() {
  return (
    <DynamicPage>
      <ReferencesContent />
    </DynamicPage>
  );
}

async function ReferencesContent() {
  const token = (await cookies()).get("rashod_session")?.value;
  const context = await getAuthContextByToken(token);

  if (!context) return <LoginScreen setupRequired={!(await getCachedHasUsers())} />;

  if (!hasPermission(context, "references:manage")) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg-base p-6 text-text-primary">
        <div className="max-w-md rounded-[16px] border border-line bg-bg-panel p-6 text-center shadow-(--shadow)">
          <p className="m-0 text-sm font-semibold text-amber">Доступ ограничен</p>
          <h1 className="m-0 mt-2 text-xl font-bold">Справочники недоступны</h1>
          <p className="m-0 mt-2 text-sm leading-6 text-text-muted">
            Нужна роль с правом «Справочники». Обратитесь к администратору системы.
          </p>
          <Link
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-[10px] border border-line bg-bg-raised px-4 text-sm font-semibold text-text-primary no-underline transition hover:border-line-strong"
            href="/"
          >
            Вернуться в рабочий стол
          </Link>
        </div>
      </main>
    );
  }

  // Live snapshot (includes people/locations) — not cached; client refreshes via SSE.
  return <ReferencesApp initialSnapshot={await getPostgresSnapshot()} />;
}
