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

  return (
    <main className="min-h-dvh bg-bg-base px-5 py-10 text-text-primary">
      <section className="mx-auto mt-[min(14vh,8rem)] max-w-md rounded-2xl border border-line bg-bg-panel p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Rashod</p>
        <h1 className="mt-2 text-2xl font-semibold">Вход в систему</h1>
        {setupRequired ? (
          <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6">
            Первый администратор ещё не создан. На сервере выполните <code>bun run auth:create-admin &lt;логин&gt; &lt;пароль&gt;</code> с паролем длиной не менее 12 символов.
          </p>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={submit}>
            <label className="grid gap-1.5 text-sm font-medium">
              Логин
              <input className="rounded-lg border border-line bg-bg-raised px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Пароль
              <input className="rounded-lg border border-line bg-bg-raised px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
            <button className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-[oklch(12%_0.04_286)] disabled:opacity-60" disabled={pending} type="submit">{pending ? "Вход…" : "Войти"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
