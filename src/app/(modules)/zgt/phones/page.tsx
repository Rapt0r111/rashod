import { Suspense } from "react";
import Link from "next/link";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { hasPermission } from "@/features/auth/permissions";
import { PortalContentFallback } from "@/features/portal/PortalChrome";
import { PhonesApp } from "@/features/zgt/PhonesApp";
import { listPhones } from "@/server/db/postgres-zgt-phones-repository";
import { getCachedHasUsers } from "@/server/cache/stable-data";
import { getRequestAuth } from "@/server/auth/request-auth";

export default function ZgtPhonesPage() {
  return (
    <Suspense fallback={<PortalContentFallback />}>
      <ZgtPhonesContent />
    </Suspense>
  );
}

async function ZgtPhonesContent() {
  const context = await getRequestAuth();
  if (!context) return <LoginScreen setupRequired={!(await getCachedHasUsers())} />;

  if (!hasPermission(context, "zgt:read")) {
    return (
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
    );
  }

  const initialData = await listPhones({ page: 1 });
  return (
    <PhonesApp permissions={context.permissions} initialData={initialData} />
  );
}
