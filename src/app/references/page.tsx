import { cookies } from "next/headers";
import Link from "next/link";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { hasPermission } from "@/features/auth/permissions";
import { ReferencesApp } from "@/features/roster/ReferencesApp";
import { getPostgresSnapshot } from "@/server/db/postgres-roster-repository";
import { getAuthContextByToken, hasUsers } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ReferencesPage() {
  const token = (await cookies()).get("rashod_session")?.value;
  const context = await getAuthContextByToken(token);

  if (!context) return <LoginScreen setupRequired={!(await hasUsers())} />;

  if (!hasPermission(context, "references:manage")) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg-base p-6 text-text-primary">
        <div className="max-w-md rounded-2xl border border-line bg-bg-panel p-6 text-center shadow-(--shadow)">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-amber">Доступ ограничен</p>
          <h1 className="m-0 mt-2 text-xl font-extrabold">Справочники недоступны</h1>
          <p className="m-0 mt-2 text-sm leading-6 text-text-muted">Нужна роль с правом «Справочники». Обратитесь к администратору системы.</p>
          <Link className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-white/5 px-4 text-sm font-bold text-text-primary transition hover:border-line-strong hover:bg-white/9" href="/">Вернуться в рабочий стол</Link>
        </div>
      </main>
    );
  }

  return <ReferencesApp initialSnapshot={await getPostgresSnapshot()} />;
}
