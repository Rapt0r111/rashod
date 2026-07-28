"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { Person, Snapshot, ToastChange } from "./types";
import type { GroupsSnapshot } from "../groups/types";
import { buildRosterCsv, exportCsvFile } from "./csv";
import { fetchJson } from "./api";
import {
  bySort,
  countInRota,
  filterPeople,
} from "./utils";
import { initialUi, reducer, type ToastBatch } from "./state";
import {
  getRosterHistorySection,
  setRosterHistorySection,
} from "./navigation-history";
import type { AdminTab } from "./components/admin-panel";
import { HistoryPanel, LocationSheet, Toast } from "./components/dialogs";
import { MainContent } from "./components/main-content";
import {
  MobileSectionNav,
  SectionDrawer,
  Sidebar,
} from "./components/navigation";
import { TopBar } from "./components/top-bar";
import { OperatorBar } from "./components/operator-bar";
import type { TasksSnapshot } from "../tasks/types";
import { hasPermission, type Permission } from "@/features/auth/permissions";
import { Loader } from "@/components/loader";

const GroupsApp = dynamic(
  () => import("../groups/GroupsApp").then((module) => module.GroupsApp),
  { loading: () => <SectionLoading /> },
);
const TasksApp = dynamic(
  () => import("../tasks/TasksApp").then((module) => module.TasksApp),
  { loading: () => <SectionLoading /> },
);
const AdminPanel = dynamic(
  () => import("./components/admin-panel").then((module) => module.AdminPanel),
);

function SectionLoading() {
  return (
    <div className="grid min-h-55 place-items-center text-text-muted">
      <Loader />
    </div>
  );
}

function SectionLoadFailure({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid min-h-55 place-items-center gap-3 rounded-2xl border border-red/35 bg-red/8 p-5 text-center" role="alert">
      <p className="m-0 text-sm font-semibold text-red">{message}</p>
      <button
        type="button"
        className="min-h-10 rounded-xl border border-accent-line bg-accent-soft px-4 font-bold text-text-primary"
        onClick={onRetry}
      >
        Повторить
      </button>
    </div>
  );
}

export function RosterApp({ initialSnapshot, permissions }: { initialSnapshot: Snapshot; permissions: Permission[] }) {
  const router = useRouter();
  const permissionContext = { permissions };
  const canWriteRoster = hasPermission(permissionContext, "roster:write");
  const canManageReferences = hasPermission(permissionContext, "references:manage");
  const canReadGroups = hasPermission(permissionContext, "groups:read");
  const canWriteGroups = hasPermission(permissionContext, "groups:write");
  const canReadTasks = hasPermission(permissionContext, "tasks:read");
  const canWriteTasks = hasPermission(permissionContext, "tasks:write");
  const [state, dispatch] = useReducer(reducer, {
    ...initialSnapshot,
    ui: initialUi,
    flashPersonId: null,
  });
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTab>("people");
  const [toastBatch, setToastBatch] = useState<ToastBatch>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [groupsSnapshot, setGroupsSnapshot] = useState<GroupsSnapshot | null>(
    null,
  );
  const [tasksSnapshot, setTasksSnapshot] = useState<TasksSnapshot | null>(null);
  const [sectionLoadErrors, setSectionLoadErrors] = useState<Partial<Record<"groups" | "tasks", string>>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const groupsRequestRef = useRef<Promise<void> | null>(null);
  const tasksRequestRef = useRef<Promise<void> | null>(null);
  const [pendingLocationPersonId, setPendingLocationPersonId] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const canAccessSection = useCallback(
    (key: string) =>
      (key !== "groups" || canReadGroups) &&
      (key !== "tasks" || canReadTasks),
    [canReadGroups, canReadTasks],
  );

  const refreshSnapshot = useCallback(async (preserveUi = true) => {
    const snapshot = await fetchJson<Snapshot>("/api/snapshot");
    dispatch({ type: "snapshot", snapshot, preserveUi });
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("roster", (event) => {
      let reason = "";
      try {
        reason = JSON.parse((event as MessageEvent<string>).data).reason ?? "";
      } catch {
        // Keep live updates resilient to malformed external events.
      }
      if (!reason || ["location-change", "undo", "people", "platoons", "locations", "location-groups", "overview-settings"].includes(reason)) {
        void refreshSnapshot(true);
      }
    });
    return () => source.close();
  }, [refreshSnapshot]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch({ type: "closeSheet" });
        dispatch({ type: "history", open: false });
        dispatch({ type: "admin", open: false });
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const loadGroupsSnapshot = useCallback(() => {
    if (!canReadGroups || groupsSnapshot || groupsRequestRef.current) return;
    setSectionLoadErrors((current) => ({ ...current, groups: undefined }));
    groupsRequestRef.current = import("../groups/api")
      .then(({ fetchGroupsSnapshot }) => fetchGroupsSnapshot())
      .then(setGroupsSnapshot)
      .catch(() => {
        setSectionLoadErrors((current) => ({
          ...current,
          groups: "Не удалось загрузить группы.",
        }));
      })
      .finally(() => {
        groupsRequestRef.current = null;
      });
  }, [canReadGroups, groupsSnapshot]);

  const loadTasksSnapshot = useCallback(() => {
    if (!canReadTasks || tasksSnapshot || tasksRequestRef.current) return;
    setSectionLoadErrors((current) => ({ ...current, tasks: undefined }));
    tasksRequestRef.current = import("../tasks/api")
      .then(({ fetchTasksSnapshot }) => fetchTasksSnapshot())
      .then(setTasksSnapshot)
      .catch(() => {
        setSectionLoadErrors((current) => ({
          ...current,
          tasks: "Не удалось загрузить задачи.",
        }));
      })
      .finally(() => {
        tasksRequestRef.current = null;
      });
  }, [canReadTasks, tasksSnapshot]);

  useEffect(() => {
    if (state.ui.activeSection === "groups") loadGroupsSnapshot();
    if (state.ui.activeSection === "tasks") loadTasksSnapshot();
  }, [loadGroupsSnapshot, loadTasksSnapshot, state.ui.activeSection]);

  useEffect(() => {
    const historySection =
      getRosterHistorySection(window.history.state) ?? initialUi.activeSection;
    const section = canAccessSection(historySection)
      ? historySection
      : initialUi.activeSection;
    window.history.replaceState(
      setRosterHistorySection(window.history.state, section),
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    if (section !== initialUi.activeSection) {
      dispatch({ type: "section", key: section });
    }

    function onPopState(event: PopStateEvent) {
      const nextSection = getRosterHistorySection(event.state);
      if (nextSection) {
        dispatch({
          type: "section",
          key: canAccessSection(nextSection)
            ? nextSection
            : initialUi.activeSection,
        });
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [canAccessSection]);

  function toggleFullscreen() {
    setActionError(null);
    try {
      const request = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
      void request.catch(() => {
        setActionError("Не удалось изменить полноэкранный режим.");
      });
    } catch {
      setActionError("Не удалось изменить полноэкранный режим.");
    }
  }

  function openAdmin(tab: AdminTab = "people") {
    if (tab === "people") {
      router.push("/references");
      return;
    }
    setAdminTab(tab);
    dispatch({ type: "admin", open: true });
  }

  async function logout() {
    setActionError(null);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      window.location.assign("/");
    } catch {
      setActionError("Не удалось выйти. Проверьте соединение и повторите.");
    }
  }

  const addToast = useCallback((change: ToastChange) => {
    setToastBatch((current) => {
      const map = new Map(current?.changes ?? []);
      const existing = map.get(change.personId);
      map.set(change.personId, {
        ...change,
        from: existing?.from ?? change.from,
      });
      return { changes: map, expiresAt: Date.now() + 3200 };
    });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastBatch(null), 3200);
  }, []);

  const applyLocation = useCallback(
    async (person: Person, to: string) => {
      if (!canWriteRoster) return;
      if (pendingLocationPersonId === person.id || person.location === to) return;
      setPendingLocationPersonId(person.id);
      setLocationError(null);
      try {
        const snapshot = await fetchJson<Snapshot>("/api/location-change", {
          method: "POST",
          body: JSON.stringify({ personId: person.id, to }),
        });
        dispatch({ type: "snapshot", snapshot, preserveUi: true });
        dispatch({ type: "flash", personId: person.id });
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => dispatch({ type: "flash", personId: null }), 420);
        addToast({
          personId: person.id,
          name: person.name,
          from: person.location,
          to,
        });
        dispatch({ type: "closeSheet" });
      } catch {
        setLocationError("Не удалось изменить местоположение. Проверьте соединение и повторите.");
      } finally {
        setPendingLocationPersonId(null);
      }
    },
    [addToast, canWriteRoster, pendingLocationPersonId],
  );

  async function undoToast() {
    if (!toastBatch) return;
    const undo = Array.from(toastBatch.changes.values()).map((change) => ({
      personId: change.personId,
      location: change.from,
    }));
    setActionError(null);
    try {
      const snapshot = await fetchJson<Snapshot>("/api/location-change", {
        method: "POST",
        body: JSON.stringify({ undo }),
      });
      dispatch({ type: "snapshot", snapshot, preserveUi: true });
      setToastBatch(null);
    } catch {
      setActionError("Не удалось отменить изменение. Повторите попытку.");
    }
  }

  function selectSection(key: string) {
    if (!canAccessSection(key)) return;
    if (state.ui.activeSection !== key) {
      window.history.pushState(
        setRosterHistorySection(window.history.state, key),
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
    dispatch({ type: "section", key });
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  function selectLocationFilters(keys: string[]) {
    const locationKeys = [...new Set(keys.filter(Boolean))];
    if (!locationKeys.length) return;
    selectSection("all");
    dispatch({ type: "locationFilters", value: locationKeys });
    dispatch({ type: "search", value: "" });
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  const sortedPlatoons = useMemo(
    () => bySort(state.platoons),
    [state.platoons],
  );
  const sortedLocations = useMemo(
    () => bySort(state.locations),
    [state.locations],
  );
  const searchedPeople = useMemo(
    () => filterPeople(state.people, state.ui.searchQuery),
    [state.people, state.ui.searchQuery],
  );
  const total = state.people.length;
  const rota = useMemo(() => countInRota(state.people), [state.people]);
  const sectionCounts = {
    groups: groupsSnapshot?.groups.length,
    tasks: tasksSnapshot?.active.length,
  };
  const isRosterSection = state.ui.activeSection !== "groups" && state.ui.activeSection !== "tasks";

  return (
    <div className="relative z-1 isolate grid h-dvh w-full max-w-[100vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-bg-base bg-[radial-gradient(circle_at_20%_-10%,oklch(32%_0.12_302/0.28),transparent_36%),radial-gradient(circle_at_86%_14%,oklch(34%_0.11_193/0.18),transparent_30%)]">
      <a className="fixed left-4 top-3 z-80 translate-y-[-150%] rounded-xl border border-accent-line bg-bg-panel px-3.5 py-2.5 text-text-primary focus:translate-y-0" href="#main-content">
        К основному содержимому
      </a>
      <TopBar
        total={total}
        rota={rota}
        unseen={state.ui.hasUnseenHistory}
        isFullscreen={isFullscreen}
        onMenu={() => setMenuOpen(true)}
        onHistory={() => dispatch({ type: "history", open: true })}
        onExport={() =>
          exportCsvFile(
            buildRosterCsv(state.people, sortedPlatoons, sortedLocations),
          )
        }
        onAdmin={() => openAdmin()}
        canManageReferences={canManageReferences}
        onLogout={logout}
        onToggleFullscreen={toggleFullscreen}
      />
      <div className="grid min-h-0 min-w-0 grid-cols-[232px_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <Sidebar
          people={state.people}
          counts={sectionCounts}
          active={state.ui.activeSection}
          onSelect={selectSection}
          canReadGroups={canReadGroups}
          canReadTasks={canReadTasks}
        />
        <main
          ref={mainRef}
          id="main-content"
          className="min-h-0 min-w-0 overflow-auto p-6 will-change-scroll max-[1180px]:p-4.5 max-[900px]:px-4 max-[900px]:pb-4"
          aria-live="polite"
        >
          <MobileSectionNav
            people={state.people}
            counts={sectionCounts}
            active={state.ui.activeSection}
            onSelect={selectSection}
            canReadGroups={canReadGroups}
            canReadTasks={canReadTasks}
          />
          {actionError && (
            <div className="fixed left-1/2 top-20 z-70 flex w-[min(560px,calc(100vw-24px))] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-red/35 bg-[color-mix(in_oklch,var(--bg-base)_94%,transparent)] px-3 py-2 text-sm text-red shadow-(--shadow)" role="alert">
              <span>{actionError}</span>
              <button type="button" className="shrink-0 rounded-lg border border-red/35 px-2 py-1 font-bold" onClick={() => setActionError(null)}>
                Закрыть
              </button>
            </div>
          )}
          {isRosterSection && !canWriteRoster && (
            <p className="mb-3 rounded-xl border border-amber/35 bg-amber/8 px-3 py-2 text-sm text-amber" role="status">
              Доступ только для просмотра.
            </p>
          )}
          {isRosterSection && (
            <OperatorBar
              people={state.people}
              locations={sortedLocations}
              locationGroups={state.locationGroups}
              total={total}
              rota={rota}
              query={state.ui.searchQuery}
              sort={state.ui.sort}
              error={locationError}
              onQueryChange={(value) => {
                setLocationError(null);
                dispatch({ type: "search", value });
              }}
              onSortChange={(value) => dispatch({ type: "sort", value })}
              onLocationFilter={selectLocationFilters}
            />
          )}
          {state.ui.activeSection === "groups" && canReadGroups ? (
            groupsSnapshot ? (
              <GroupsApp initialSnapshot={groupsSnapshot} canWrite={canWriteGroups} />
            ) : sectionLoadErrors.groups ? (
              <SectionLoadFailure message={sectionLoadErrors.groups} onRetry={loadGroupsSnapshot} />
            ) : (
              <SectionLoading />
            )
          ) : state.ui.activeSection === "tasks" && canReadTasks ? (
            tasksSnapshot ? (
              <TasksApp
                key={[...tasksSnapshot.active, ...tasksSnapshot.history].map((task) => `${task.id}:${task.updatedAt}`).join("|")}
                initialSnapshot={tasksSnapshot}
                canWrite={canWriteTasks}
              />
            ) : sectionLoadErrors.tasks ? (
              <SectionLoadFailure message={sectionLoadErrors.tasks} onRetry={loadTasksSnapshot} />
            ) : (
              <SectionLoading />
            )
          ) : (
            <MainContent
              state={state}
              people={searchedPeople}
              allPeople={state.people}
              platoons={sortedPlatoons}
              locations={sortedLocations}
              onSection={selectSection}
              onLocationFilter={selectLocationFilters}
              onCustomizeOverview={() => openAdmin("overview")}
              onLocation={applyLocation}
              pendingPersonId={pendingLocationPersonId}
              canWrite={canWriteRoster}
              canCustomizeOverview={canManageReferences}
              dispatch={dispatch}
            />
          )}
        </main>
      </div>
      <SectionDrawer
        open={isMenuOpen}
        people={state.people}
        counts={sectionCounts}
        active={state.ui.activeSection}
        onClose={() => setMenuOpen(false)}
        onSelect={selectSection}
        onHistory={() => {
          setMenuOpen(false);
          dispatch({ type: "history", open: true });
        }}
        onExport={() => {
          setMenuOpen(false);
          exportCsvFile(
            buildRosterCsv(state.people, sortedPlatoons, sortedLocations),
          );
        }}
        onAdmin={() => {
          setMenuOpen(false);
          openAdmin();
        }}
        canManageReferences={canManageReferences}
        canReadGroups={canReadGroups}
        canReadTasks={canReadTasks}
        onLogout={() => {
          setMenuOpen(false);
          void logout();
        }}
      />
      {canWriteRoster && <LocationSheet
        person={
          state.people.find(
            (person) => person.id === state.ui.editingPersonId,
          ) ?? null
        }
        locations={sortedLocations}
        open={state.ui.isLocationSheetOpen}
        onClose={() => dispatch({ type: "closeSheet" })}
        onPick={applyLocation}
      />}
      <HistoryPanel
        open={state.ui.isHistoryPanelOpen}
        logs={state.changeLog}
        locations={sortedLocations}
        onClose={() => dispatch({ type: "history", open: false })}
      />
       {canManageReferences && <AdminPanel
         key={adminTab}
         open={state.ui.isAdminOpen}
         initialTab={adminTab}
         snapshot={state}
        onClose={() => dispatch({ type: "admin", open: false })}
        onSaved={(snapshot) =>
          dispatch({ type: "snapshot", snapshot, preserveUi: true })
        }
       />}
      <Toast
        batch={toastBatch}
        locations={sortedLocations}
        onUndo={undoToast}
      />
    </div>
  );
}
