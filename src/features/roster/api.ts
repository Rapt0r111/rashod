export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && typeof window !== "undefined") window.location.assign("/");
    throw new FetchError(payload.error ?? `HTTP_${response.status}`, response.status, payload);
  }
  return response.json() as Promise<T>;
}
