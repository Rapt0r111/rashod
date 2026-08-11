import { cookies } from "next/headers";
import Link from "next/link";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { hasPermission } from "@/features/auth/permissions";
import { ZgtHome } from "@/features/portal/ZgtStub";
import { getAuthContextByToken, hasUsers } from "@/server/auth";
import { getEquipmentStats } from "@/server/db/postgres-zgt-repository";
import { getPhoneStats } from "@/server/db/postgres-zgt-phones-repository";
import { getStorageItemStats } from "@/server/db/postgres-zgt-storage-items-repository";

export const dynamic = "force-dynamic";

export default async function ZgtPage() {
  const token = (await cookies()).get("rashod_session")?.value;
  const context = await getAuthContextByToken(token);
  if (!context) return <LoginScreen setupRequired={!(await hasUsers())} />;

  if (!hasPermission(context, "zgt:read")) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg-base p-6 text-text-primary">
        <div className="max-w-md rounded-[16px] border border-line bg-bg-panel p-6 text-center shadow-(--shadow)">
          <p className="m-0 text-sm font-semibold text-amber">Доступ ограничен</p>
          <h1 className="m-0 mt-2 text-xl font-bold">ЗГТ недоступен</h1>
          <p className="m-0 mt-2 text-sm leading-6 text-text-muted">
            Нужна роль с правом «Просмотр ЗГТ».
          </p>
          <Link
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-[10px] border border-line bg-bg-raised px-4 text-sm font-semibold text-text-primary no-underline transition hover:border-line-strong"
            href="/portal"
          >
            К модулям портала
          </Link>
        </div>
      </main>
    );
  }

  const emptyEquipment = { total: 0, inUse: 0, storage: 0, repair: 0, broken: 0 };
  const emptyPhones = { total: 0, checkedIn: 0, checkedOut: 0 };
  const emptyStorage = { total: 0, stock: 0, inUse: 0, broken: 0, lost: 0 };

  const [equipmentStats, phoneStats, storageStats] = await Promise.all([
    getEquipmentStats().catch(() => emptyEquipment),
    getPhoneStats().catch(() => emptyPhones),
    getStorageItemStats().catch(() => emptyStorage),
  ]);

  return (
    <ZgtHome
      displayName={context.user.displayName}
      permissions={context.permissions}
      equipmentStats={equipmentStats}
      phoneStats={phoneStats}
      storageStats={storageStats}
    />
  );
}
