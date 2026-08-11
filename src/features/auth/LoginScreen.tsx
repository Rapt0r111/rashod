"use client";

import { useState, type SyntheticEvent } from "react";

export function LoginScreen({ setupRequired }: { setupRequired: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (payload?.error === "LOGIN_TEMPORARILY_BLOCKED")
          throw new Error("Вход временно заблокирован. Сбросьте пароль на сервере или подождите 15 минут.");
        if (payload?.error === "CSRF_REJECTED")
          throw new Error("Неверный адрес входа. Откройте приложение по адресу сервера.");
        if (response.status >= 500)
          throw new Error("Ошибка подключения к базе данных. Проверьте app\\.env и журнал start-production.");
        throw new Error("Неверный логин или пароль");
      }
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  const fieldClass =
    "min-h-[42px] w-full rounded-[10px] border border-line bg-bg-raised px-3 text-sm text-text-primary outline-none transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--cyan)_22%,transparent)]";

  return (
    <main className="grid min-h-dvh place-items-center bg-bg-base px-5 py-10 text-text-primary">
      <section className="w-full max-w-md rounded-[16px] border border-line bg-bg-panel p-6 shadow-(--shadow)">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,var(--accent),var(--cyan))] text-base font-extrabold text-[oklch(12%_0.04_286)]"
            aria-hidden
          >
            Р
          </div>
          <div className="min-w-0">
            <h1 className="m-0 text-xl font-bold tracking-[-0.02em]">Вход в систему</h1>
            <p className="m-0 mt-0.5 text-sm text-text-muted">Rashod · оперативный рабочий стол</p>
          </div>
        </div>

        {setupRequired ? (
          <p
            className="m-0 rounded-[13px] border border-[color-mix(in_oklch,var(--amber)_40%,transparent)] bg-[color-mix(in_oklch,var(--amber)_12%,transparent)] p-4 text-sm leading-6 text-text-primary"
            role="status"
          >
            Первый администратор ещё не создан. На сервере выполните{" "}
            <code className="rounded-md border border-line bg-bg-raised px-1.5 py-0.5 font-mono text-[13px]">
              bun run auth:create-admin &lt;логин&gt; &lt;пароль&gt;
            </code>{" "}
            с паролем длиной не менее 12 символов.
          </p>
        ) : (
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
              Логин
              <input
                className={fieldClass}
                autoComplete="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
              Пароль
              <input
                className={fieldClass}
                type="password"
                autoComplete="current-password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error ? (
              <p
                className="m-0 rounded-[10px] border border-[color-mix(in_oklch,var(--red)_35%,transparent)] bg-[color-mix(in_oklch,var(--red)_12%,transparent)] px-3 py-2.5 text-sm text-red"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <button
              className="inline-flex min-h-[42px] items-center justify-center rounded-[10px] border border-accent-line bg-accent px-4 text-sm font-semibold text-[oklch(12%_0.04_286)] transition-[filter,opacity] duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-panel disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Вход…" : "Войти"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
