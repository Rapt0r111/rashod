import { Suspense, type ReactNode } from "react";
import {
  PortalContentFallback,
  PortalShell,
} from "@/features/portal/PortalChrome";
import { modulesForPermissions } from "@/features/portal/modules";
import { getRequestAuth } from "@/server/auth/request-auth";

/**
 * Shared portal chrome for /portal and /zgt/* only.
 * Header tree is always the same (no pathname branching) to avoid hydration mismatches.
 * Расход (`/`) is outside this group and uses its own TopBar.
 */
export default function ModulesLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PortalContentFallback />}>
      <ModulesShellGate>{children}</ModulesShellGate>
    </Suspense>
  );
}

async function ModulesShellGate({ children }: { children: ReactNode }) {
  const context = await getRequestAuth();
  if (!context) {
    return children;
  }

  const availableModuleIds = modulesForPermissions(context.permissions)
    .filter((module) => module.available)
    .map((module) => module.id);

  return (
    <PortalShell
      displayName={context.user.displayName}
      availableModuleIds={availableModuleIds}
    >
      {children}
    </PortalShell>
  );
}
