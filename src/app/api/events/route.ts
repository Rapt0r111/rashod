import { subscribe } from "@/server/events";
import { requireAnyPermission } from "@/server/auth";
import { sseHeaders } from "@/server/cache/http";


export async function GET(request: Request) {
  const auth = await requireAnyPermission(request, ["roster:read", "groups:read", "tasks:read"]);
  if (auth instanceof Response) return auth;
  if (request.signal.aborted) {
    return new Response(null, { status: 204 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (interval) clearInterval(interval);
    unsubscribe?.();
    request.signal.removeEventListener("abort", cleanup);
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      send(`event: ready\ndata: {"ok":true}\n\n`);
      unsubscribe = subscribe((event) =>
        send(`event: roster\ndata: ${event}\n\n`),
      );
      interval = setInterval(
        () => send(`event: ping\ndata: ${Date.now()}\n\n`),
        25_000,
      );
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: sseHeaders(),
  });
}
