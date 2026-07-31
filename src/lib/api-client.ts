export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get code() {
    return this.message;
  }
}

type FetchJsonOptions = RequestInit & {
  /** When false, omit Content-Type (e.g. GET without body). Default true for mutations with body. */
  json?: boolean;
};

function shouldSendJson(init?: FetchJsonOptions) {
  if (init?.json === false) return false;
  if (init?.json === true) return true;
  const method = (init?.method ?? "GET").toUpperCase();
  return method !== "GET" && method !== "HEAD";
}

export async function fetchJson<T>(url: string, init?: FetchJsonOptions): Promise<T> {
  const headers = new Headers(init?.headers);
  if (shouldSendJson(init) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.assign("/");
      // Hang briefly so callers do not toast before reload; reject if navigation stalls.
      return new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new ApiError("AUTH_REQUIRED", 401, payload));
        }, 2000);
      });
    }
    const code =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `HTTP_${response.status}`;
    throw new ApiError(code, response.status, payload);
  }

  return response.json() as Promise<T>;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return `${fallback}. Проверьте соединение и повторите попытку.`;
  }
  switch (error.status) {
    case 401:
      return "Сессия истекла. Войдите снова.";
    case 400:
      return "Проверьте введённые данные и повторите попытку.";
    case 403:
      return "Недостаточно прав для этого действия.";
    case 404:
      return "Данные уже изменились или удалены. Обновите экран и повторите попытку.";
    case 409:
      return "Данные изменились в другой операции. Обновите экран и повторите попытку.";
    case 429:
      return "Слишком много запросов. Подождите немного и повторите попытку.";
    default:
      return error.status >= 500
        ? "Сервер временно недоступен. Повторите попытку позже."
        : `${fallback}. Повторите попытку.`;
  }
}
