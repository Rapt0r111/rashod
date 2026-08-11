import { cookies } from "next/headers";
import Link from "next/link";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { hasPermission } from "@/features/auth/permissions";
import { PhonesApp } from "@/features/zgt/PhonesApp";
import { getAuthContextByToken, hasUsers } from "@/server/auth";
import { listPhones } from "@/server/db/postgres-zgt-phones-repository";

export const dynamic = "force-dynamic";

export default async function ZgtPhonesPage() {
  const token = (await cookies()).get("rashod_session")?.value;
  const context = await getAuthContextByToken(token);
  if (!context) return <LoginScreen setupRequired={!(await hasUsers())} />;

  if (!hasPermission(context, "zgt:read")) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg-base p-6 text-text-primary">
        <div className="max-w-md rounded-[16px] border border-line bg-bg-panel p-6 text-center shadow-(--shadow)">
          <p className="m-0 text-sm font-semibold text-amber">Доступ ограничен</p>
          <h1 className="m-0 mt-2 text-xl font-bold">Телефоны ЗГТ недоступны</h1>
          <p className="m-0 mt-2 text-sm leading-6 text-text-muted">
            Нужно право «Просмотр ЗГТ».
          </p>
          <Link
            href="/portal"
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-[10px] border border-line bg-bg-raised px-4 text-sm font-semibold text-text-primary no-underline transition hover:border-line-strong"
          >
            К модулям
          </Link>
        </div>
      </main>
    );
  }

  const initialData = await listPhones({ page: 1 });
  return (
    <PhonesApp
      displayName={context.user.displayName}
      permissions={context.permissions}
      initialData={initialData}
    />
  );
}
