import { cookies } from "next/headers";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { PortalHome } from "@/features/portal/PortalHome";
import { hasAnyPortalModule } from "@/features/portal/modules";
import { getAuthContextByToken, hasUsers } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const token = (await cookies()).get("rashod_session")?.value;
  const context = await getAuthContextByToken(token);
  if (!context) return <LoginScreen setupRequired={!(await hasUsers())} />;

  if (!hasAnyPortalModule(context.permissions)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg-base p-6 text-text-primary">
        <p className="rounded-xl border border-line bg-bg-panel p-5">
          Доступ к рабочим модулям не выдан.
        </p>
      </main>
    );
  }

  return (
    <PortalHome
      displayName={context.user.displayName}
      permissions={context.permissions}
    />
  );
}
