import { Suspense } from "react";
import Link from "next/link";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { hasPermission } from "@/features/auth/permissions";
import { PortalContentFallback } from "@/features/portal/PortalChrome";
import { StorageItemsApp } from "@/features/zgt/StorageItemsApp";
import { listStorageItems } from "@/server/db/postgres-zgt-storage-items-repository";
import { getCachedHasUsers } from "@/server/cache/stable-data";
import { getRequestAuth } from "@/server/auth/request-auth";

export default function ZgtStorageItemsPage() {
  return (
    <Suspense fallback={<PortalContentFallback />}>
      <ZgtStorageItemsContent />
    </Suspense>
  );
}

async function ZgtStorageItemsContent() {
  const context = await getRequestAuth();
  if (!context) return <LoginScreen setupRequired={!(await getCachedHasUsers())} />;

  if (!hasPermission(context, "zgt:read")) {
    return (
      <div className="max-w-md rounded-[16px] border border-line bg-bg-panel p-6 text-center shadow-(--shadow)">
        <p className="m-0 text-sm font-semibold text-amber">Доступ ограничен</p>
        <h1 className="m-0 mt-2 text-xl font-bold">Носители ЗГТ недоступны</h1>
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

  const initialData = await listStorageItems({ page: 1 });
  return (
    <StorageItemsApp permissions={context.permissions} initialData={initialData} />
  );
}
