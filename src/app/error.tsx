"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg-base p-5 text-text-primary">
      <section className="grid w-full max-w-lg gap-4 rounded-3xl border border-line bg-bg-panel p-6 text-center shadow-(--shadow)" role="alert">
        <div>
          <h1 className="m-0 text-2xl">Не удалось открыть экран</h1>
          <p className="mt-2 mb-0 text-sm text-text-secondary">
            Произошла непредвиденная ошибка. Повторите загрузку экрана.
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-accent-line bg-accent px-4 font-extrabold text-[oklch(12%_0.04_286)]"
          onClick={unstable_retry}
        >
          Повторить
        </button>
      </section>
    </main>
  );
}
