import { Suspense, type ReactNode } from "react";
import { PageFallback } from "@/components/page-fallback";

/**
 * PPR boundary for request-time data (cookies, live snapshots).
 *
 * Fallback is a blank app background — not a Loader. Root `loading.tsx` was
 * removed so client navigations keep the previous screen until the next route
 * is ready instead of flashing a global spinner.
 */
export function DynamicPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}
