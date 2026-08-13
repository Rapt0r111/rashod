"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type RealtimeDomain = "roster" | "groups" | "tasks" | "zgt" | "unknown";

export type RealtimeEvent = {
  reason: string;
  domain: RealtimeDomain;
  ts: number;
};

export type RealtimeStatus = "connecting" | "open" | "error";

type Listener = (event: RealtimeEvent) => void;

type RealtimeActions = {
  subscribe: (listener: Listener) => () => void;
  /** Subscribe and only fire when domain matches (or unknown). */
  subscribeDomain: (
    domains: readonly RealtimeDomain[],
    listener: Listener,
  ) => () => void;
};

/** Stable actions — status changes must not resubscribe listeners. */
const RealtimeActionsContext = createContext<RealtimeActions | null>(null);
const RealtimeStatusContext = createContext<RealtimeStatus>("connecting");

/** Reasons published by API routes that mutate roster domain data. */
const ROSTER_REASONS = new Set([
  "location-change",
  "undo",
  "people",
  "platoons",
  "locations",
  "location-groups",
  "overview-settings",
]);

/** Reasons published for duty groups (plus `group*` prefix fallback). */
const GROUPS_REASONS = new Set(["groups", "groups-refresh"]);

/** Reasons published for tasks (plus `task*` prefix fallback). */
const TASKS_REASONS = new Set(["tasks"]);

/** Reasons published for ЗГТ (plus `zgt*` prefix fallback). */
const ZGT_REASONS = new Set(["zgt"]);

/**
 * Map NOTIFY reason → domain. Empty/malformed → `unknown` so every subscriber
 * still refreshes (legacy clients often sent empty payloads).
 */
export function classifyRealtimeReason(reason: string): RealtimeDomain {
  if (!reason) return "unknown";
  if (ROSTER_REASONS.has(reason)) return "roster";
  if (GROUPS_REASONS.has(reason) || reason.startsWith("group")) return "groups";
  if (TASKS_REASONS.has(reason) || reason.startsWith("task")) return "tasks";
  if (ZGT_REASONS.has(reason) || reason.startsWith("zgt")) return "zgt";
  return "unknown";
}

function parseEventData(data: string): RealtimeEvent {
  let reason = "";
  let ts = Date.now();
  try {
    const parsed = JSON.parse(data) as { reason?: string; ts?: number };
    reason = typeof parsed.reason === "string" ? parsed.reason : "";
    if (typeof parsed.ts === "number" && Number.isFinite(parsed.ts)) ts = parsed.ts;
  } catch {
    // Keep live updates resilient to malformed payloads.
  }
  return { reason, domain: classifyRealtimeReason(reason), ts };
}

/** Union comma-separated reason tokens so debounce does not drop earlier reasons. */
export function mergeRealtimeReasons(a: string, b: string): string {
  const parts = new Set<string>();
  for (const raw of [a, b]) {
    for (const token of raw.split(",")) {
      const t = token.trim();
      if (t) parts.add(t);
    }
  }
  return [...parts].join(",");
}

const DEFAULT_DEBOUNCE_MS = 200;
/** After this long in reconnect without OPEN, surface error for operator banner. */
const DEGRADED_AFTER_MS = 8_000;

export function RealtimeProvider({
  children,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: {
  children: ReactNode;
  debounceMs?: number;
}) {
  const listenersRef = useRef(new Set<Listener>());
  const pendingRef = useRef<RealtimeEvent | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const degradedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  const clearDegradedTimer = useCallback(() => {
    if (degradedTimerRef.current) {
      clearTimeout(degradedTimerRef.current);
      degradedTimerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    timerRef.current = null;
    const event = pendingRef.current;
    pendingRef.current = null;
    if (!event) return;
    for (const listener of listenersRef.current) listener(event);
  }, []);

  const enqueue = useCallback(
    (event: RealtimeEvent) => {
      const previous = pendingRef.current;
      if (!previous) {
        pendingRef.current = event;
      } else {
        // Merge domains: mixed reasons in the window widen to unknown.
        // Merge reasons: same-domain bursts (people + location-change) must keep both.
        const domain =
          previous.domain === event.domain ? event.domain : "unknown";
        pendingRef.current = {
          reason: mergeRealtimeReasons(previous.reason, event.reason),
          domain,
          ts: event.ts,
        };
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, debounceMs);
    },
    [debounceMs, flush],
  );

  useEffect(() => {
    let alive = true;
    const source = new EventSource("/api/events");
    const safeSetStatus = (next: RealtimeStatus) => {
      if (alive) setStatus(next);
    };
    const safeSetStatusFn = (update: (current: RealtimeStatus) => RealtimeStatus) => {
      if (alive) setStatus(update);
    };

    safeSetStatus("connecting");

    const markOpen = () => {
      clearDegradedTimer();
      safeSetStatus("open");
    };

    const armDegradedTimer = () => {
      clearDegradedTimer();
      degradedTimerRef.current = setTimeout(() => {
        if (!alive) return;
        if (source.readyState !== EventSource.OPEN) {
          safeSetStatus("error");
        }
      }, DEGRADED_AFTER_MS);
    };

    source.addEventListener("open", markOpen);
    source.addEventListener("ready", markOpen);
    source.addEventListener("roster", (message) => {
      if (!alive) return;
      enqueue(parseEventData((message as MessageEvent<string>).data));
    });
    source.addEventListener("error", () => {
      if (!alive) return;
      // Terminal close → immediate error. Reconnect path → connecting, then
      // error if still not open after DEGRADED_AFTER_MS (operator banner).
      if (source.readyState === EventSource.CLOSED) {
        clearDegradedTimer();
        safeSetStatus("error");
        return;
      }
      safeSetStatusFn((current) => (current === "error" ? "error" : "connecting"));
      armDegradedTimer();
    });

    // Initial connect can hang without error events; arm once on mount.
    armDegradedTimer();

    return () => {
      alive = false;
      clearDegradedTimer();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
      source.close();
    };
  }, [clearDegradedTimer, enqueue]);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const subscribeDomain = useCallback(
    (domains: readonly RealtimeDomain[], listener: Listener) => {
      const allowed = new Set(domains);
      return subscribe((event) => {
        if (event.domain === "unknown" || allowed.has(event.domain)) {
          listener(event);
        }
      });
    },
    [subscribe],
  );

  // Stable across status flaps so useRealtimeDomain does not resubscribe.
  const actions = useMemo(
    () => ({ subscribe, subscribeDomain }),
    [subscribe, subscribeDomain],
  );

  return (
    <RealtimeActionsContext.Provider value={actions}>
      <RealtimeStatusContext.Provider value={status}>
        {children}
      </RealtimeStatusContext.Provider>
    </RealtimeActionsContext.Provider>
  );
}

export function useRealtime() {
  const actions = useContext(RealtimeActionsContext);
  const status = useContext(RealtimeStatusContext);
  if (!actions) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return { ...actions, status };
}

/** Safe hook when provider may be absent. */
export function useRealtimeOptional() {
  const actions = useContext(RealtimeActionsContext);
  const status = useContext(RealtimeStatusContext);
  if (!actions) return null;
  return { ...actions, status };
}

export function useRealtimeDomain(
  domains: readonly RealtimeDomain[],
  onEvent: Listener,
  enabled = true,
) {
  const actions = useContext(RealtimeActionsContext);
  const status = useContext(RealtimeStatusContext);
  const onEventRef = useRef(onEvent);
  const domainsKey = domains.join("\0");
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !actions) return;
    const allowed = domainsKey.split("\0") as RealtimeDomain[];
    return actions.subscribeDomain(allowed, (event) => {
      onEventRef.current(event);
    });
    // `actions` is stable (memoized without status). Status flaps must not resubscribe.
  }, [domainsKey, enabled, actions]);

  // No provider → treat as error so UI can surface live-sync loss.
  return actions ? status : "error";
}
