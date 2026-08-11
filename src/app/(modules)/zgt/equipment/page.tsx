import { Suspense } from "react";
import Link from "next/link";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { hasPermission } from "@/features/auth/permissions";
import { PortalContentFallback } from "@/features/portal/PortalChrome";
import { EquipmentApp } from "@/features/zgt/EquipmentApp";
import { listEquipment } from "@/server/db/postgres-zgt-repository";
import { getCachedHasUsers } from "@/server/cache/stable-data";
import { getRequestAuth } from "@/server/auth/request-auth";

export default function ZgtEquipmentPage() {
  return (
    <Suspense fallback={<PortalContentFallback />}>
      <ZgtEquipmentContent />
    </Suspense>
  );
}

async function ZgtEquipmentContent() {
  const context = await getRequestAuth();
  if (!context) return <LoginScreen setupRequired={!(await getCachedHasUsers())} />;

  if (!hasPermission(context, "zgt:read")) {
    return (
      <div className="max-w-md rounded-[16px] border border-line bg-bg-panel p-6 text-center shadow-(--shadow)">
        <p className="m-0 text-sm font-semibold text-amber">Доступ ограничен</p>
        <h1 className="m-0 mt-2 text-xl font-bold">Техника ЗГТ недоступна</h1>
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

  const initialData = await listEquipment({ page: 1 });
  return (
    <EquipmentApp
      permissions={context.permissions}
      initialData={initialData}
    />
  );
}
