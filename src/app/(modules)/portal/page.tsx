import { Suspense } from "react";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { PortalContentFallback } from "@/features/portal/PortalChrome";
import { PortalHome } from "@/features/portal/PortalHome";
import { hasAnyPortalModule } from "@/features/portal/modules";
import { getCachedHasUsers } from "@/server/cache/stable-data";
import { getRequestAuth } from "@/server/auth/request-auth";

export default function PortalPage() {
  return (
    <Suspense fallback={<PortalContentFallback />}>
      <PortalContent />
    </Suspense>
  );
}

async function PortalContent() {
  const context = await getRequestAuth();
  if (!context) return <LoginScreen setupRequired={!(await getCachedHasUsers())} />;

  if (!hasAnyPortalModule(context.permissions)) {
    return (
      <p className="rounded-xl border border-line bg-bg-panel p-5">
        Доступ к рабочим модулям не выдан.
      </p>
    );
  }

  return <PortalHome permissions={context.permissions} />;
}
