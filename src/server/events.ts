import { pg } from "./db/postgres";

type Listener = (event: string) => void;

const CHANNEL = "rashod_roster_events";
const listeners = new Set<Listener>();
let listenerReady = false;
let listenerPromise: Promise<void> | null = null;

function emit(event: string) {
  for (const listener of listeners) listener(event);
}

function ensureListener() {
  if (listenerPromise) return listenerPromise;
  listenerPromise = pg().listen(CHANNEL, emit, () => { listenerReady = true; }).then(() => undefined).catch((error: unknown) => {
    listenerReady = false;
    listenerPromise = null;
    console.error("[events] PostgreSQL LISTEN failed", error instanceof Error ? error.message : "unknown error");
  });
  return listenerPromise;
}

/** PostgreSQL NOTIFY fan-out works across application replicas. */
export function subscribe(listener: Listener) {
  listeners.add(listener);
  void ensureListener();
  return () => listeners.delete(listener);
}

export function publishRosterChanged(reason: string) {
  const payload = JSON.stringify({ reason, ts: Date.now() });
  // The local listener receives this too. Before it is ready, keep same-process
  // development behaviour rather than dropping the first update.
  if (!listenerReady) emit(payload);
  void pg()`SELECT pg_notify(${CHANNEL}, ${payload})`.catch((error: unknown) => {
    console.error("[events] PostgreSQL NOTIFY failed", error instanceof Error ? error.message : "unknown error");
  });
}
