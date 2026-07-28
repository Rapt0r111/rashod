import type { Dispatch, ReactNode } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import {
  CaretDownIcon,
  CheckIcon,
  ArrowRightIcon,
  ArrowDownIcon,
  ListMagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { CollapsibleFilter } from "@/components/collapsible-filter";
import { DisclosureContent } from "@/components/disclosure-content";
import type {
  LocationGroup,
  LocationOption,
  OverviewBlockId,
  OverviewSettings,
  Person,
  Platoon,
} from "../types";
import type { Action, State } from "../state";
import {
  countInRota,
  conscriptionOptions,
  cx,
  peopleForPlatoon,
  locationLabel,
  locationToken,
  relativeTime,
  filterPeople,
} from "../utils";
import { locationsAndCustom, overviewLocationMetrics } from "../roster-metrics";
import { normalizeOverviewSettings, overviewBlock } from "../overview-settings";
import { sortListItems } from "@/components/list-utils";
import { PersonCard, RosterRow, toneClasses } from "./person-views";

export function MainContent(props: {
  state: State;
  people: Person[];
  allPeople: Person[];
  platoons: Platoon[];
  locations: LocationOption[];
  onSection: (key: string) => void;
  onLocationFilter: (keys: string[]) => void;
  onCustomizeOverview: () => void;
  onLocation: (person: Person, to: string) => void;
  pendingPersonId?: string | null;
  canWrite: boolean;
  canCustomizeOverview: boolean;
  dispatch: Dispatch<Action>;
}) {
  const { state, people, allPeople, platoons, locations } = props;
  if (state.ui.searchQuery.trim())
    return (
      <SearchResults
        query={state.ui.searchQuery}
        state={state}
        people={allPeople}
        platoons={platoons}
        locations={locations}
        onLocation={props.onLocation}
        pendingPersonId={props.pendingPersonId}
        canWrite={props.canWrite}
        dispatch={props.dispatch}
      />
    );
  if (state.ui.activeSection === "overview")
    return (
      <Overview
        people={state.people}
        platoons={platoons}
        locations={locations}
        locationGroups={state.locationGroups}
        overviewSettings={state.overviewSettings}
        changeLog={state.changeLog}
        serverTime={state.serverTime}
        ui={state.ui}
        onSection={props.onSection}
        onLocationFilter={props.onLocationFilter}
        onCustomizeOverview={props.onCustomizeOverview}
        canCustomizeOverview={props.canCustomizeOverview}
        dispatch={props.dispatch}
      />
    );
  if (state.ui.activeSection === "all")
    return (
      <AllPlatoons
        state={state}
        people={people}
        platoons={platoons}
        locations={locations}
        onLocation={props.onLocation}
        pendingPersonId={props.pendingPersonId}
        canWrite={props.canWrite}
        dispatch={props.dispatch}
      />
    );
  const platoon =
    platoons.find((item) => item.key === state.ui.activeSection) ?? platoons[0];
  return (
    <PlatoonSection
      state={state}
      platoon={platoon}
      people={people}
      locations={locations}
      onLocation={props.onLocation}
      canWrite={props.canWrite}
      dispatch={props.dispatch}
    />
  );
}

function SearchResults({
  query,
  state,
  people,
  platoons,
  locations,
  onLocation,
  pendingPersonId,
  canWrite,
  dispatch,
}: {
  query: string;
  state: State;
  people: Person[];
  platoons: Platoon[];
  locations: LocationOption[];
  onLocation: (person: Person, to: string) => void;
  pendingPersonId?: string | null;
  canWrite: boolean;
  dispatch: Dispatch<Action>;
}) {
  const platoonLabels = useMemo(
    () => new Map(platoons.map((platoon) => [platoon.id, platoon.label])),
    [platoons],
  );
  const results = useMemo(
    () =>
      sortListItems(filterPeople(people, query), state.ui.sort, {
        label: (person) => person.name,
        rank: (person) => person.rank,
        defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
      }),
    [people, query, state.ui.sort],
  );
  const handleOpenSheet = useCallback(
    (personId: string) => dispatch({ type: "openSheet", personId }),
    [dispatch],
  );

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-[1640px] gap-4.5 max-[1180px]:gap-4">
      <SectionHeader
        title="Результаты поиска"
        subtitle={`${results.length} ${results.length === 1 ? "человек" : "человек найдено"} по запросу «${query}»`}
      />
      {results.length > 0 ? (
        <div className="grid min-w-0 grid-cols-1 gap-2.5 min-[1280px]:grid-cols-2">
          {results.map((person) => (
            <RosterRow
              key={person.id}
              person={person}
              locations={locations}
              contextLabel={platoonLabels.get(person.platoonId)}
              flash={state.flashPersonId === person.id}
              pending={pendingPersonId === person.id}
              canWrite={canWrite}
              onLocation={onLocation}
              onMore={handleOpenSheet}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  );
}

function Overview({
  people,
  platoons,
  locations,
  locationGroups,
  overviewSettings,
  changeLog,
  serverTime,
  ui,
  onSection,
  onLocationFilter,
  onCustomizeOverview,
  canCustomizeOverview,
  dispatch,
}: {
  people: Person[];
  platoons: Platoon[];
  locations: LocationOption[];
  locationGroups: LocationGroup[];
  overviewSettings: OverviewSettings;
  changeLog: import("../types").LogEntry[];
  serverTime: number;
  ui: State["ui"];
  onSection: (key: string) => void;
  onLocationFilter: (keys: string[]) => void;
  onCustomizeOverview: () => void;
  canCustomizeOverview: boolean;
  dispatch: Dispatch<Action>;
}) {
  const settings = useMemo(
    () => normalizeOverviewSettings(overviewSettings),
    [overviewSettings],
  );
  const heroBlock = overviewBlock(settings, "hero")!;
  const activityBlock = overviewBlock(settings, "activity")!;
  const distributionBlock = overviewBlock(settings, "location-distribution")!;
  const platoonsBlock = overviewBlock(settings, "platoons")!;
  const locationCardsBlock = overviewBlock(settings, "location-cards")!;
  const recentActivityBlock = overviewBlock(settings, "recent-activity")!;
  const distributionConfig = distributionBlock.config;
  const platoonsConfig = platoonsBlock.config;
  const locationCardsConfig = locationCardsBlock.config;
  const selectedPlatoonKeys = useMemo(
    () => selectedFilterKeys(ui.platoonFilterKeys, ui.platoonFilter),
    [ui.platoonFilter, ui.platoonFilterKeys],
  );
  const selectedLocationKeys = useMemo(
    () => selectedFilterKeys(ui.locationFilterKeys, ui.locationFilter),
    [ui.locationFilter, ui.locationFilterKeys],
  );
  const selectedConscriptionKeys = useMemo(
    () => selectedFilterKeys(ui.conscriptionFilterKeys, ui.conscriptionFilter),
    [ui.conscriptionFilter, ui.conscriptionFilterKeys],
  );
  const filteredPeople = useMemo(
    () =>
      people.filter(
        (person) =>
          (!selectedPlatoonKeys.length ||
            selectedPlatoonKeys.includes(person.platoonId)) &&
          (!selectedLocationKeys.length ||
            selectedLocationKeys.includes(person.location)) &&
          (!selectedConscriptionKeys.length ||
            (person.conscriptionNumber !== null &&
              selectedConscriptionKeys.includes(person.conscriptionNumber))),
      ),
    [
      people,
      selectedConscriptionKeys,
      selectedLocationKeys,
      selectedPlatoonKeys,
    ],
  );
  const filteredPersonIds = useMemo(
    () => new Set(filteredPeople.map((person) => person.id)),
    [filteredPeople],
  );
  const filteredChangeLog = useMemo(
    () => changeLog.filter((entry) => filteredPersonIds.has(entry.personId)),
    [changeLog, filteredPersonIds],
  );
  const platoonGroups = useMemo(
    () =>
      platoons.map((platoon) => ({
        platoon,
        count: peopleForPlatoon(people, platoon.id).length,
      })),
    [people, platoons],
  );
  const availableLocations = useMemo(
    () => locationsAndCustom(people, locations),
    [people, locations],
  );
  const availableConscriptionNumbers = useMemo(
    () => conscriptionOptions(people),
    [people],
  );
  const allLocationMetrics = useMemo(
    () => overviewLocationMetrics(filteredPeople, locations, locationGroups),
    [filteredPeople, locations, locationGroups],
  );

  const selectedDistribution = useMemo(
    () =>
      sortOverviewItemsByCount(
        visibleLocationMetrics(
          allLocationMetrics,
          distributionConfig.locationSelection,
          distributionConfig.showEmpty,
        ),
      ),
    [
      allLocationMetrics,
      distributionConfig.locationSelection,
      distributionConfig.showEmpty,
    ],
  );
  const selectedLocationCards = useMemo(
    () =>
      sortOverviewItemsByCount(
        visibleLocationMetrics(
          allLocationMetrics,
          locationCardsConfig.locationSelection,
          locationCardsConfig.showEmpty,
        ),
      ),
    [
      allLocationMetrics,
      locationCardsConfig.locationSelection,
      locationCardsConfig.showEmpty,
    ],
  );
  const maxDistribution = useMemo(
    () => Math.max(1, ...selectedDistribution.map((item) => item.count)),
    [selectedDistribution],
  );
  const maxCards = useMemo(
    () => Math.max(1, ...selectedLocationCards.map((item) => item.count)),
    [selectedLocationCards],
  );
  const total = filteredPeople.length;
  const present = useMemo(() => countInRota(filteredPeople), [filteredPeople]);
  const presentPct = total === 0 ? 0 : Math.round((present / total) * 100);
  const peakLoc = useMemo(
    () =>
      allLocationMetrics
        .filter((item) => item.count > 0)
        .reduce<OverviewLocationMetricLike | null>(
          (peak, item) => (!peak || item.count > peak.count ? item : peak),
          null,
        ),
    [allLocationMetrics],
  );
  const blockOrder = useMemo(
    () => new Map(settings.blocks.map((block, index) => [block.id, index])),
    [settings.blocks],
  );
  const blockVisible = useCallback(
    (id: OverviewBlockId) =>
      settings.blocks.find((block) => block.id === id)?.visible !== false,
    [settings.blocks],
  );
  const blockDensity = useCallback(
    (id: OverviewBlockId) =>
      settings.blocks.find((block) => block.id === id)?.density ?? "standard",
    [settings.blocks],
  );
  const blockLayout = useCallback(
    (id: OverviewBlockId) =>
      settings.blocks.find((block) => block.id === id)?.layout ?? "full",
    [settings.blocks],
  );
  const panelDensity = useCallback(
    (id: OverviewBlockId) =>
      blockDensity(id) === "compact" ? "gap-2 p-3" : "gap-3 p-4.5",
    [blockDensity],
  );
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleLocation = useCallback((key: string) => {
    setExpandedLocations((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const openLocationPeople = useCallback(
    (item: OverviewLocationMetricLike) => {
      onLocationFilter(item.locationKeys);
    },
    [onLocationFilter],
  );

  const now = serverTime;
  const last1h = useMemo(
    () => filteredChangeLog.filter((l) => l.ts >= now - 3_600_000).length,
    [filteredChangeLog, now],
  );
  const last24h = useMemo(
    () => filteredChangeLog.filter((l) => l.ts >= now - 86_400_000).length,
    [filteredChangeLog, now],
  );

  const platoonStats = useMemo(
    () =>
      platoons.map((platoon) => {
        const roster = peopleForPlatoon(filteredPeople, platoon.id);
        const inRota = countInRota(roster);
        const rate =
          roster.length === 0 ? 0 : Math.round((inRota / roster.length) * 100);
        return { platoon, roster, inRota, rate };
      }),
    [filteredPeople, platoons],
  );
  const visiblePlatoonStats = useMemo(() => {
    const selected = selectedOverviewItems(
      platoonStats,
      platoonsConfig.platoonSelection,
    );
    const visible = platoonsConfig.showEmpty
      ? selected
      : selected.filter((item) => item.roster.length > 0);
    return sortOverviewPlatoonStatsByCount(visible);
  }, [platoonStats, platoonsConfig.platoonSelection, platoonsConfig.showEmpty]);

  const heroCards = {
    total: <StatCard label="Всего по списку" value={total} />,
    present: (
      <StatCard
        label="В расположении"
        value={present}
        tone="green"
        sub={presentPct + "% от списочного"}
        trend="up"
      />
    ),
    peakLocation: (
      <StatCard
        label={peakLoc?.label ?? "Пиковая точка"}
        value={peakLoc?.count ?? 0}
        tone="blue"
        sub={
          peakLoc
            ? String(Math.round((peakLoc.count / Math.max(1, total)) * 100)) +
              "% от списочного"
            : "Нет активных мест"
        }
      />
    ),
    activeLocations: (
      <StatCard
        label="Активных точек"
        value={allLocationMetrics.filter((item) => item.count > 0).length}
        tone="cyan"
        sub={peakLoc ? "Пик: " + peakLoc.label : undefined}
      />
    ),
  };
  const activityValues = {
    lastHour: last1h,
    lastDay: last24h,
    logTotal: filteredChangeLog.length,
  };
  const activityLabels = {
    lastHour: "за час",
    lastDay: "за 24 ч",
    logTotal: "всего в журнале",
  };
  const recentEntries = filteredChangeLog.slice(0, recentActivityBlock.config.limit);

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-[1640px] gap-4.5 max-[1180px]:gap-4">
      <SectionHeader
        title="Обзор"
        subtitle="Строевая записка на текущий момент"
        action={canCustomizeOverview ? (
          <button
            type="button"
            className="inline-flex min-h-10 max-w-full cursor-pointer items-center justify-center rounded-xl border border-accent-line bg-accent-soft px-3 text-xs font-bold text-text-primary transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan max-[560px]:w-full"
            onClick={onCustomizeOverview}
          >
            Настроить Обзор
          </button>
        ) : undefined}
      />

      <div className="grid min-w-0 gap-2.5">
        <CollapsibleFilter
          activeCount={
            selectedPlatoonKeys.length +
            selectedLocationKeys.length +
            selectedConscriptionKeys.length
          }
          onClear={() => {
            dispatch({ type: "platoonFilter", value: null });
            dispatch({ type: "locationFilter", value: null });
            dispatch({ type: "conscriptionFilter", value: null });
          }}
        >
          <FilterPills
            label="Подразделение"
            items={[
              { key: null, label: "Все подразделения", count: people.length },
              ...platoonGroups.map(({ platoon, count }) => ({
                key: platoon.id,
                label: platoon.label,
                count,
              })),
            ]}
            active={ui.platoonFilter}
            activeKeys={selectedPlatoonKeys}
            onPick={(value) =>
              dispatch(
                value === null
                  ? { type: "platoonFilter", value: null }
                  : { type: "togglePlatoonFilter", value },
              )
            }
          />
          <FilterPills
            label="Локация"
            items={[
              { key: null, label: "Все локации", count: people.length },
              ...availableLocations.map((item) => ({
                key: item.key,
                label: item.label,
                count: item.count,
              })),
            ]}
            active={ui.locationFilter}
            activeKeys={selectedLocationKeys}
            onPick={(value) =>
              dispatch(
                value === null
                  ? { type: "locationFilter", value: null }
                  : { type: "toggleLocationFilter", value },
              )
            }
          />
          <FilterPills
            label="Призыв"
            items={[
              { key: null, label: "Все призывы", count: people.length },
              ...availableConscriptionNumbers,
            ]}
            active={ui.conscriptionFilter}
            activeKeys={selectedConscriptionKeys}
            onPick={(value) =>
              dispatch(
                value === null
                  ? { type: "conscriptionFilter", value: null }
                  : { type: "toggleConscriptionFilter", value },
              )
            }
          />
        </CollapsibleFilter>
      </div>

      <div className="grid min-w-0 grid-cols-2 items-start gap-4.5 max-[1180px]:gap-4 max-[1100px]:grid-cols-1">
        {blockVisible("hero") && (
          <OverviewBlock
            order={blockOrder.get("hero") ?? 0}
            density={blockDensity("hero")}
            layout={blockLayout("hero")}
          >
            <div className="grid min-w-0 grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[720px]:grid-cols-1">
              {heroBlock.config.metricKeys.map((key) => (
                <div className=" contents" key={key}>{heroCards[key]}</div>
              ))}
            </div>
          </OverviewBlock>
        )}

        {blockVisible("activity") && (
          <OverviewBlock
            order={blockOrder.get("activity") ?? 1}
            density={blockDensity("activity")}
            layout={blockLayout("activity")}
          >
            <div className="flex min-w-0 flex-wrap gap-2 max-[420px]:flex-col">
              {activityBlock.config.metricKeys.map((key) => (
                <span
                  className="inline-flex min-h-8.5 max-w-full items-center gap-1.5 rounded-full border border-line bg-white/4 px-3.5 text-[13px] text-text-secondary max-[420px]:w-full max-[420px]:justify-center"
                  key={key}
                >
                  <strong>{activityValues[key]}</strong> {activityLabels[key]}
                </span>
              ))}
            </div>
          </OverviewBlock>
        )}

        {blockVisible("location-distribution") && (
          <OverviewBlock
            order={blockOrder.get("location-distribution") ?? 2}
            density={blockDensity("location-distribution")}
            layout={blockLayout("location-distribution")}
          >
            <section
              className={cx(
                "grid min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel shadow-(--shadow)",
                panelDensity("location-distribution"),
              )}
            >
              <h2 className="min-w-0 text-base font-semibold leading-snug">
                Распределение по местам
              </h2>
              <div className="grid min-w-0 gap-2">
                {selectedDistribution.length === 0 && (
                  <OverviewEmpty text="Нет мест для отображения. Проверьте состав блока в настройках." />
                )}
                {selectedDistribution.map((item) => {
                  const percent =
                    total === 0 ? 0 : Math.round((item.count / total) * 100);
                  const isExpandable =
                    distributionConfig.expandableGroups &&
                    item.kind === "group" &&
                    Boolean(item.members?.length);
                  const isExpanded = expandedLocations.has(item.key);
                  return (
                    <div className="grid min-w-0 gap-1.5" key={item.key}>
                      <div className="grid min-w-0 grid-cols-[minmax(0,1.05fr)_minmax(100px,1fr)_auto] items-center gap-3 max-[720px]:grid-cols-[minmax(0,1fr)_auto] max-[720px]:gap-x-2 max-[720px]:gap-y-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cx(
                              "h-2 w-2 shrink-0 rounded-full",
                              toneClasses(item.token).bg,
                            )}
                          />
                          {isExpandable ? (
                            <button
                              type="button"
                              className="flex min-w-0 max-w-full cursor-pointer items-center gap-1 overflow-hidden text-left text-[13px] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                              aria-expanded={isExpanded}
                              onClick={() => toggleLocation(item.key)}
                            >
                              <CaretDownIcon
                                size={14}
                                className={cx(
                                  "shrink-0 transition-transform",
                                  isExpanded && "rotate-180",
                                )}
                                aria-hidden="true"
                              />
                              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                                {item.label}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="min-w-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-left text-[13px] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                              onClick={() => openLocationPeople(item)}
                            >
                              {item.label}
                            </button>
                          )}
                        </div>
                        <div className="h-2 min-w-0 overflow-hidden rounded-full bg-white/6 max-[720px]:col-span-full max-[720px]:row-start-2">
                          <div
                            className={cx(
                              "h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none",
                              toneClasses(item.token).bg,
                            )}
                            style={{
                              width: (item.count / maxDistribution) * 100 + "%",
                            }}
                          />
                        </div>
                        <div className="flex min-w-0 items-center justify-end gap-1.5 whitespace-nowrap max-[720px]:col-start-2 max-[720px]:row-start-1">
                          <strong className="font-mono text-sm leading-none tabular-nums text-text-primary">
                            {item.count}
                          </strong>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition hover:bg-white/8 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                            aria-label={`Показать людей: ${item.label}`}
                            title="Показать людей"
                            onClick={() => openLocationPeople(item)}
                          >
                            <ArrowRightIcon size={14} aria-hidden="true" />
                          </button>
                          {distributionConfig.showPercent && (
                            <span className="min-w-[2.5ch] text-right font-mono text-[11px] leading-none tabular-nums text-text-muted">
                              {percent}%
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpandable && (
                        <DisclosureContent open={isExpanded}>
                          <div className="ml-4 grid min-w-0 gap-1 border-l border-line pl-3">
                            {item.members?.map((member) => (
                              <div
                                className="flex min-w-0 items-center justify-between gap-2 text-xs text-text-muted"
                                key={member.key}
                              >
                                <span className="min-w-0 truncate">
                                  {member.label}
                                </span>
                                {distributionConfig.showMemberCounts && (
                                  <strong className="shrink-0 font-mono tabular-nums text-text-secondary">
                                    {member.count}
                                  </strong>
                                )}
                              </div>
                            ))}
                          </div>
                        </DisclosureContent>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </OverviewBlock>
        )}

        {blockVisible("platoons") && (
          <OverviewBlock
            order={blockOrder.get("platoons") ?? 3}
            density={blockDensity("platoons")}
            layout={blockLayout("platoons")}
          >
            <section
              className={cx(
                "grid min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel shadow-(--shadow)",
                panelDensity("platoons"),
              )}
            >
              <h2 className="min-w-0 text-base font-semibold leading-snug">
                По подразделениям
              </h2>
              <p className="-mt-2 text-xs leading-5 text-text-muted">
                Состав и присутствие
              </p>
              <div className="grid gap-2.5">
                {visiblePlatoonStats.length === 0 && (
                  <OverviewEmpty text="Нет подразделений для отображения. Проверьте состав блока в настройках." />
                )}
                {visiblePlatoonStats.map(
                  ({ platoon, roster, inRota, rate }) => (
                    <button
                      type="button"
                      className="grid w-full cursor-pointer gap-1.5 rounded-[14px] border border-line bg-white/[0.035] px-3.5 py-3 text-left text-text-primary transition duration-200 hover:border-line-strong hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                      key={platoon.id}
                      onClick={() => onSection(platoon.key)}
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-bold">
                          {platoon.label}
                        </span>
                        <span className="shrink-0 font-mono text-[13px] tabular-nums text-text-muted">
                          {inRota}/{roster.length}
                        </span>
                      </div>
                      {platoonsConfig.showPercent && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                          <div
                            className="h-full rounded-full bg-green transition-[width] duration-200 motion-reduce:transition-none"
                            style={{ width: rate + "%" }}
                          />
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-text-muted">
                        {platoonsConfig.showPercent && (
                          <span>
                            Присутствие:{" "}
                            <strong className="font-mono text-text-secondary">
                              {rate}%
                            </strong>
                          </span>
                        )}
                        <span
                          className={cx(
                            !platoonsConfig.showPercent && "ml-auto",
                          )}
                        >
                          Убыло:{" "}
                          <strong className="font-mono text-text-secondary">
                            {roster.length - inRota}
                          </strong>
                        </span>
                      </div>
                    </button>
                  ),
                )}
              </div>
            </section>
          </OverviewBlock>
        )}

        {blockVisible("location-cards") && (
          <OverviewBlock
            order={blockOrder.get("location-cards") ?? 4}
            density={blockDensity("location-cards")}
            layout={blockLayout("location-cards")}
          >
            <section
              className={cx(
                "grid min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel shadow-(--shadow)",
                panelDensity("location-cards"),
              )}
            >
              <h2 className="min-w-0 text-base font-semibold leading-snug">
                Карта точек
              </h2>
              <p className="-mt-2 text-xs leading-5 text-text-muted">
                Плотность распределения по локациям
              </p>
              <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 max-[720px]:grid-cols-2 max-[420px]:grid-cols-1">
                {selectedLocationCards.length === 0 && (
                  <OverviewEmpty
                    className="col-span-full"
                    text="Нет мест для отображения. Проверьте состав блока в настройках."
                  />
                )}
                {selectedLocationCards.map((item) => {
                  const rate =
                    total === 0 ? 0 : Math.round((item.count / total) * 100);
                  const isExpandable =
                    locationCardsConfig.expandableGroups &&
                    item.kind === "group" &&
                    Boolean(item.members?.length);
                  const isExpanded = expandedLocations.has(item.key);
                  return (
                    <div
                      className="grid min-w-0 gap-2 overflow-hidden rounded-[14px] border border-line bg-bg-panel p-3.5 transition duration-200 hover:border-line-strong"
                      key={item.key}
                    >
                      <div className="flex min-w-0 items-center gap-1.75">
                        <span
                          className={cx(
                            "h-2 w-2 shrink-0 rounded-full",
                            toneClasses(item.token).bg,
                          )}
                        />
                        {isExpandable ? (
                          <button
                            type="button"
                            className="flex min-w-0 cursor-pointer items-center gap-1 text-left text-[13px] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                            aria-expanded={isExpanded}
                            onClick={() => toggleLocation(item.key)}
                          >
                            <CaretDownIcon
                              size={14}
                              className={cx(
                                "shrink-0 transition-transform",
                                isExpanded && "rotate-180",
                              )}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 truncate">
                              {item.label}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="min-w-0 cursor-pointer truncate text-left text-[13px] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                            onClick={() => openLocationPeople(item)}
                          >
                            {item.label}
                          </button>
                        )}
                        {isExpandable && (
                          <button
                            type="button"
                            className="ml-auto inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition hover:bg-white/8 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                            aria-label={`Показать людей: ${item.label}`}
                            title="Показать людей"
                            onClick={() => openLocationPeople(item)}
                          >
                            <ArrowRightIcon size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <strong className="font-mono text-[28px] font-extrabold leading-none tabular-nums text-text-primary">
                        {item.count}
                      </strong>
                      {locationCardsConfig.showPercent && (
                        <>
                          <div className="h-1 overflow-hidden rounded-full bg-white/6">
                            <div
                              className={cx(
                                "h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none",
                                toneClasses(item.token).bg,
                              )}
                              style={{
                                width: (item.count / maxCards) * 100 + "%",
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs tabular-nums text-text-muted">
                            {rate}%
                          </span>
                        </>
                      )}
                      {isExpandable && (
                        <DisclosureContent open={isExpanded}>
                          <div className="grid min-w-0 gap-1 border-t border-line pt-2">
                            {item.members?.map((member) => (
                              <div
                                className="flex min-w-0 items-center justify-between gap-2 text-xs text-text-muted"
                                key={member.key}
                              >
                                <span className="min-w-0 truncate">
                                  {member.label}
                                </span>
                                {locationCardsConfig.showMemberCounts && (
                                  <strong className="shrink-0 font-mono tabular-nums text-text-secondary">
                                    {member.count}
                                  </strong>
                                )}
                              </div>
                            ))}
                          </div>
                        </DisclosureContent>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </OverviewBlock>
        )}

        {blockVisible("recent-activity") && (
          <OverviewBlock
            order={blockOrder.get("recent-activity") ?? 5}
            density={blockDensity("recent-activity")}
            layout={blockLayout("recent-activity")}
          >
            <section
              className={cx(
                "grid min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel shadow-(--shadow)",
                panelDensity("recent-activity"),
              )}
            >
              <h2 className="min-w-0 text-base font-semibold leading-snug">
                Последние перемещения
              </h2>
              <p className="-mt-2 text-xs leading-5 text-text-muted">
                Ближайшая активность
              </p>
              <div className="grid gap-0.5">
                {recentEntries.length === 0 && (
                  <OverviewEmpty text="Перемещений пока нет." />
                )}
                {recentEntries.map((entry) => {
                  const fromLabel = locationLabel(entry.from, locations);
                  const toLabel = locationLabel(entry.to, locations);
                  const fromToken = locationToken(entry.from, locations);
                  const toToken = locationToken(entry.to, locations);
                  return (
                    <div
                      className="grid min-h-10 min-w-0 grid-cols-[minmax(120px,1fr)_auto_100px] items-center gap-3 border-b border-white/4 last:border-0 max-[720px]:grid-cols-1 max-[720px]:gap-1 max-[720px]:py-2"
                      key={entry.id}
                    >
                      <div className="min-w-0">
                        <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-text-primary">
                          {entry.name}
                        </strong>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5 text-text-muted max-[720px]:flex-wrap max-[720px]:justify-start">
                        <button
                          type="button"
                          className={cx(
                            "inline-flex min-h-6 min-w-0 max-w-45 cursor-pointer items-center gap-1 truncate rounded-full border px-2 text-[11px] text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                            toneClasses(fromToken).border,
                            toneClasses(fromToken).soft,
                          )}
                          aria-label={`Показать людей в месте ${fromLabel}`}
                          onClick={() => onLocationFilter([entry.from])}
                        >
                          {fromLabel}
                        </button>
                        <ArrowRightIcon size={14} weight="regular" />
                        <button
                          type="button"
                          className={cx(
                            "inline-flex min-h-6 min-w-0 max-w-45 cursor-pointer items-center gap-1 truncate rounded-full border px-2 text-[11px] text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                            toneClasses(toToken).border,
                            toneClasses(toToken).soft,
                          )}
                          aria-label={`Показать людей в месте ${toLabel}`}
                          onClick={() => onLocationFilter([entry.to])}
                        >
                          {toLabel}
                        </button>
                      </div>
                      <span className="justify-self-end whitespace-nowrap text-xs text-text-muted max-[720px]:justify-self-start">
                        {recentActivityBlock.config.showRelativeTime
                          ? relativeTime(entry.ts)
                          : overviewDateTime(entry.ts)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </OverviewBlock>
        )}
      </div>
    </section>
  );
}

type OverviewLocationMetricLike = ReturnType<
  typeof overviewLocationMetrics
>[number];

function visibleLocationMetrics(
  items: OverviewLocationMetricLike[],
  selection: { mode: "all" | "selected"; keys: string[] },
  showEmpty: boolean,
) {
  const selected =
    selection.mode === "all"
      ? items
      : items.filter((item) => selection.keys.includes(item.key));
  return showEmpty ? selected : selected.filter((item) => item.count > 0);
}

function selectedOverviewItems<T extends { platoon: Platoon }>(
  items: T[],
  selection: { mode: "all" | "selected"; keys: string[] },
) {
  return selection.mode === "all"
    ? items
    : items.filter((item) => selection.keys.includes(item.platoon.id));
}

function overviewDateTime(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function selectedFilterKeys(keys: string[] | null, active: string | null) {
  return keys ?? (active ? [active] : []);
}

function sortOverviewItemsByCount(items: OverviewLocationMetricLike[]) {
  return [...items].sort(
    (left, right) =>
      right.count - left.count ||
      left.sortOrder - right.sortOrder ||
      left.label.localeCompare(right.label, "ru"),
  );
}

function sortOverviewPlatoonStatsByCount<
  T extends { platoon: Platoon; roster: Person[] },
>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      right.roster.length - left.roster.length ||
      left.platoon.sortOrder - right.platoon.sortOrder ||
      left.platoon.label.localeCompare(right.platoon.label, "ru"),
  );
}

function OverviewEmpty({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "m-0 rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-xs text-text-muted",
        className,
      )}
    >
      {text}
    </p>
  );
}

function AllPlatoons({
  state,
  people,
  platoons,
  locations,
  onLocation,
  pendingPersonId,
  canWrite,
  dispatch,
}: {
  state: State;
  people: Person[];
  platoons: Platoon[];
  locations: LocationOption[];
  onLocation: (person: Person, to: string) => void;
  pendingPersonId?: string | null;
  canWrite: boolean;
  dispatch: Dispatch<Action>;
}) {
  const selectedPlatoonKeys = selectedFilterKeys(
    state.ui.platoonFilterKeys,
    state.ui.platoonFilter,
  );
  const visiblePlatoons = selectedPlatoonKeys.length
    ? platoons.filter((platoon) => selectedPlatoonKeys.includes(platoon.id))
    : platoons;

  // Memoize per-platoon groups for FilterPills and rendering
  const platoonGroups = useMemo(
    () =>
      platoons.map((p) => ({
        p,
        group: peopleForPlatoon(people, p.id),
      })),
    [people, platoons],
  );

  // Memoize visible groups with their rota counts
  const visibleGroups = useMemo(
    () =>
      visiblePlatoons
        .map((platoon) => {
          const unfilteredGroup = peopleForPlatoon(people, platoon.id);
          const locationFiltered = state.ui.locationFilterKeys?.length
            ? unfilteredGroup.filter((person) =>
                state.ui.locationFilterKeys?.includes(person.location),
              )
            : state.ui.locationFilter
              ? unfilteredGroup.filter(
                  (person) => person.location === state.ui.locationFilter,
                )
              : unfilteredGroup;
          const selectedConscriptionKeys = selectedFilterKeys(
            state.ui.conscriptionFilterKeys,
            state.ui.conscriptionFilter,
          );
          const group = selectedConscriptionKeys.length
            ? locationFiltered.filter((person) =>
                person.conscriptionNumber !== null &&
                selectedConscriptionKeys.includes(person.conscriptionNumber),
              )
            : locationFiltered;
          return {
            platoon,
            group: sortListItems(group, state.ui.sort, {
              label: (person) => person.name,
              rank: (person) => person.rank,
              defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
            }),
            inRota: countInRota(group),
          };
        })
        .filter((item) => item.group.length > 0),
    [
      people,
      visiblePlatoons,
      state.ui.locationFilter,
      state.ui.locationFilterKeys,
      state.ui.conscriptionFilter,
      state.ui.conscriptionFilterKeys,
      state.ui.sort,
    ],
  );

  // Memoize the openSheet callback to avoid re-renders
  const handleOpenSheet = useCallback(
    (personId: string) => {
      dispatch({ type: "openSheet", personId });
    },
    [dispatch],
  );

  // Memoize the platoonFilter callback
  const handlePlatoonFilter = useCallback(
    (value: string | null) => {
      dispatch(
        value === null
          ? { type: "platoonFilter", value: null }
          : { type: "togglePlatoonFilter", value },
      );
    },
    [dispatch],
  );
  const handleLocationFilter = useCallback(
    (value: string | null) => {
      dispatch(
        value === null
          ? { type: "locationFilter", value: null }
          : { type: "toggleLocationFilter", value },
      );
    },
    [dispatch],
  );
  const handleConscriptionFilter = useCallback(
    (value: string | null) => {
      dispatch(
        value === null
          ? { type: "conscriptionFilter", value: null }
          : { type: "toggleConscriptionFilter", value },
      );
    },
    [dispatch],
  );
  const availableLocations = useMemo(
    () => locationsAndCustom(people, locations),
    [people, locations],
  );
  const availableConscriptionNumbers = useMemo(() => conscriptionOptions(people), [people]);

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-[1640px] gap-4.5 max-[1180px]:gap-4">
      <SectionHeader
        title="Все взвода"
        subtitle="Полный список, быстрые кнопки меняют место одним нажатием"
      />
      <CollapsibleFilter
        activeCount={
          selectedFilterKeys(state.ui.platoonFilterKeys, state.ui.platoonFilter).length +
          selectedFilterKeys(state.ui.locationFilterKeys, state.ui.locationFilter).length +
          selectedFilterKeys(state.ui.conscriptionFilterKeys, state.ui.conscriptionFilter).length
        }
        onClear={() => {
          handlePlatoonFilter(null);
          handleLocationFilter(null);
          dispatch({ type: "conscriptionFilter", value: null });
        }}
      >
        <FilterPills
          label="Подразделение"
          items={[
            { key: null, label: "Все подразделения", count: people.length },
            ...platoonGroups.map(({ p, group }) => ({
              key: p.id,
              label: p.label,
              count: group.length,
            })),
          ]}
          active={state.ui.platoonFilter}
          activeKeys={selectedFilterKeys(state.ui.platoonFilterKeys, state.ui.platoonFilter)}
          onPick={handlePlatoonFilter}
        />
        <FilterPills
          label="Локация"
          items={[
            { key: null, label: "Все локации", count: people.length },
            ...availableLocations.map((item) => ({
              key: item.key,
              label: item.label,
              count: item.count,
            })),
          ]}
          active={state.ui.locationFilter}
          activeKeys={selectedFilterKeys(state.ui.locationFilterKeys, state.ui.locationFilter)}
          onPick={handleLocationFilter}
        />
        <FilterPills
          label="Призыв"
          items={[{ key: null, label: "Все призывы", count: people.length }, ...availableConscriptionNumbers]}
          active={state.ui.conscriptionFilter}
          activeKeys={selectedFilterKeys(state.ui.conscriptionFilterKeys, state.ui.conscriptionFilter)}
          onPick={handleConscriptionFilter}
        />
      </CollapsibleFilter>
      {visibleGroups.map(({ platoon, group, inRota }) => (
        <section className="grid gap-2.5" key={platoon.id}>
          <div className="flex items-center gap-3 text-xs font-bold text-text-muted after:h-px after:flex-1 after:bg-line">
            <span className="uppercase">{platoon.label}</span>
            <b className="order-3 text-text-secondary">
              {inRota}/{group.length} в роте
            </b>
          </div>
          <div className="grid grid-cols-1 gap-2.5 min-[1280px]:grid-cols-2 min-[1840px]:grid-cols-3">
            {group.map((person) => (
              <RosterRow
                key={person.id}
                person={person}
                locations={locations}
                flash={state.flashPersonId === person.id}
                pending={pendingPersonId === person.id}
                canWrite={canWrite}
                onLocation={onLocation}
                onMore={handleOpenSheet}
              />
            ))}
          </div>
        </section>
      ))}
      {visibleGroups.length === 0 && <EmptyState />}
    </section>
  );
}

function PlatoonSection({
  state,
  platoon,
  people,
  locations,
  canWrite,
  dispatch,
}: {
  state: State;
  platoon: Platoon;
  people: Person[];
  locations: LocationOption[];
  onLocation: (person: Person, to: string) => void;
  canWrite: boolean;
  dispatch: Dispatch<Action>;
}) {
  const platoonPeople = useMemo(
    () => peopleForPlatoon(people, platoon.id),
    [people, platoon.id],
  );
  const available = useMemo(
    () => locationsAndCustom(platoonPeople, locations),
    [platoonPeople, locations],
  );
  const filtered = useMemo(() => {
    const locationFiltered = state.ui.locationFilterKeys?.length
      ? platoonPeople.filter((person) =>
          state.ui.locationFilterKeys?.includes(person.location),
        )
      : state.ui.locationFilter
        ? platoonPeople.filter(
            (person) => person.location === state.ui.locationFilter,
          )
        : platoonPeople;
    const selectedConscriptionKeys = selectedFilterKeys(
      state.ui.conscriptionFilterKeys,
      state.ui.conscriptionFilter,
    );
    const base = selectedConscriptionKeys.length
      ? locationFiltered.filter((person) =>
          person.conscriptionNumber !== null &&
          selectedConscriptionKeys.includes(person.conscriptionNumber),
        )
      : locationFiltered;
    return sortListItems(base, state.ui.sort, {
      label: (person) => person.name,
      rank: (person) => person.rank,
      defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
    });
  }, [
    platoonPeople,
    state.ui.locationFilter,
    state.ui.locationFilterKeys,
    state.ui.conscriptionFilter,
    state.ui.conscriptionFilterKeys,
    state.ui.sort,
  ]);

  const handleOpenSheet = useCallback(
    (personId: string) => {
      dispatch({ type: "openSheet", personId });
    },
    [dispatch],
  );

  const handleLocationFilter = useCallback(
    (value: string | null) => {
      dispatch(
        value === null
          ? { type: "locationFilter", value: null }
          : { type: "toggleLocationFilter", value },
      );
    },
    [dispatch],
  );
  const handleConscriptionFilter = useCallback(
    (value: string | null) => {
      dispatch(
        value === null
          ? { type: "conscriptionFilter", value: null }
          : { type: "toggleConscriptionFilter", value },
      );
    },
    [dispatch],
  );
  const availableConscriptionNumbers = useMemo(() => conscriptionOptions(platoonPeople), [platoonPeople]);

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-[1640px] gap-4.5 max-[1180px]:gap-4">
      <SectionHeader
        title={platoon.label}
        subtitle={`${platoonPeople.length} человек по списку`}
      />
      <CollapsibleFilter
        activeCount={
          selectedFilterKeys(state.ui.locationFilterKeys, state.ui.locationFilter).length +
          selectedFilterKeys(state.ui.conscriptionFilterKeys, state.ui.conscriptionFilter).length
        }
        onClear={() => {
          handleLocationFilter(null);
          dispatch({ type: "conscriptionFilter", value: null });
        }}
      >
        <FilterPills
          label="Локация"
          items={[
            { key: null, label: "Все локации", count: platoonPeople.length },
            ...available.map((item) => ({
              key: item.key,
              label: item.label,
              count: item.count,
            })),
          ]}
          active={state.ui.locationFilter}
          activeKeys={selectedFilterKeys(state.ui.locationFilterKeys, state.ui.locationFilter)}
          onPick={handleLocationFilter}
        />
        <FilterPills
          label="Призыв"
          items={[{ key: null, label: "Все призывы", count: platoonPeople.length }, ...availableConscriptionNumbers]}
          active={state.ui.conscriptionFilter}
          activeKeys={selectedFilterKeys(state.ui.conscriptionFilterKeys, state.ui.conscriptionFilter)}
          onPick={handleConscriptionFilter}
        />
      </CollapsibleFilter>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {filtered.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            locations={locations}
            flash={state.flashPersonId === person.id}
            canWrite={canWrite}
            onClick={handleOpenSheet}
          />
        ))}
      </div>
      {filtered.length === 0 && <EmptyState />}
    </section>
  );
}

const SectionHeader = memo(function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 max-[560px]:flex-col">
      <div className="min-w-0">
        <h1 className="m-0 text-[26px] leading-[1.1]">{title}</h1>
        <p className="mt-1.75 wrap-break-word text-text-muted">
          {subtitle}
        </p>
      </div>
      {action}
    </div>
  );
});

function OverviewBlock({
  order,
  density,
  layout,
  children,
}: {
  order: number;
  density: "standard" | "compact";
  layout: "full" | "half";
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "grid w-full min-w-0 items-start",
        density === "compact" ? "gap-2" : "gap-3",
        layout === "full"
          ? "col-span-full"
          : "col-span-1 max-[1100px]:col-span-full",
      )}
      style={{ order }}
    >
      {children}
    </div>
  );
}

const StatCard = memo(function StatCard({
  label,
  value,
  tone = "accent",
  sub,
  trend,
}: {
  label: string;
  value: number;
  tone?: string;
  sub?: string;
  trend?: "up" | "down";
}) {
  return (
    <div className="min-w-0  overflow-hidden rounded-2xl border border-line bg-bg-panel p-4.5 shadow-(--shadow)">
      <strong
        className={cx(
          "block font-mono text-[30px] font-extrabold leading-none tabular-nums",
          toneClasses(tone).text,
        )}
      >
        {value}
      </strong>
      <span className="mt-2 block wrap-break-word text-text-secondary">
        {label}
      </span>
      {sub && (
        <span className="mt-4.5 flex min-w-0 items-center gap-1.5 wrap-break-word text-xs text-text-muted">
          {trend === "up" && (
            <ArrowRightIcon
              size={12}
              weight="bold"
              className="text-green"
            />
          )}
          {trend === "down" && (
            <ArrowDownIcon
              size={12}
              weight="bold"
              className="text-red"
            />
          )}
          {sub}
        </span>
      )}
    </div>
  );
});

const FilterPills = memo(function FilterPills({
  label,
  items,
  active,
  activeKeys,
  onPick,
}: {
  label: string;
  items: Array<{ key: string | null; label: string; count: number }>;
  active: string | null;
  activeKeys?: string[];
  onPick: (value: string | null) => void;
}) {
  const selectedKeys = activeKeys ?? (active ? [active] : []);
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-text-muted"
      aria-label={label}
    >
      <span className="mr-1 text-xs font-semibold">{label}</span>
      {selectedKeys.length > 1 && (
        <span className="rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-xs text-text-primary">
          Выбрано: {selectedKeys.length}
        </span>
      )}
      {items.map((item) => {
        const selected = item.key === null ? selectedKeys.length === 0 : selectedKeys.includes(item.key);
        return (
          <button
            type="button"
            key={item.key ?? "all"}
            aria-pressed={selected}
            data-selected={selected ? "true" : undefined}
            className={cx(
              "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 text-xs transition-[background,border-color,box-shadow,color,filter] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-panel",
              selected
                ? "border-accent bg-accent font-extrabold text-[oklch(12%_0.04_286)] shadow-[0_0_0_2px_var(--accent),0_0_18px_oklch(68%_0.19_302/0.22)] hover:brightness-110"
                : "border-line bg-white/4 text-text-secondary hover:border-line-strong hover:bg-white/8 hover:text-text-primary",
            )}
            onClick={() => onPick(item.key)}
          >
            {selected && <CheckIcon size={14} weight="bold" aria-hidden="true" />}
            {item.label}
            <b className={selected ? "ml-1 text-current opacity-70" : "ml-1 text-text-muted"}>{item.count}</b>
          </button>
        );
      })}
    </div>
  );
});

export const EmptyState = memo(function EmptyState() {
  return (
    <div className="grid min-h-55 place-items-center gap-2 rounded-[18px] border border-dashed border-line-strong text-text-muted">
      <ListMagnifyingGlassIcon size={36} weight="regular" />
      <strong className="text-text-primary">Никого не найдено</strong>
      <span>Измените поиск или фильтр.</span>
    </div>
  );
});
