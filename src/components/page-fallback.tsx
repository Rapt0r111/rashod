/**
 * PPR static shell while auth + live data stream in.
 *
 * Intentionally NOT a full-screen spinner: with Cache Components, this shell is
 * what users see on first paint / first visit to a route. A centered Loader
 * made every module switch feel like a full reload.
 *
 * Route transitions no longer use app/loading.tsx, so Next keeps the previous
 * page visible until the next route is ready (Activity + soft navigation).
 */
export function PageFallback() {
  return (
    <main
      className="min-h-dvh bg-bg-base"
      aria-busy="true"
      aria-live="polite"
      aria-label="Загрузка"
    />
  );
}
