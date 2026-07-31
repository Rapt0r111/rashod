import type { Dispatch } from "react";
import { useCallback, useMemo, useState } from "react";
import { ArrowRightIcon, CaretDownIcon } from "@phosphor-icons/react";
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
  filterPeopleByRosterFilters,
  selectedFilterKeys,
} from "../utils";
import { locationsAndCustom, overviewLocationMetrics } from "../roster-metrics";
import { normalizeOverviewSettings, overviewBlock } from "../overview-settings";
import { toneClasses } from "./person-views";
import {
  FilterPills,
  OverviewBlock,
  OverviewEmpty,
  SectionHeader,
  StatCard,
  overviewDateTime,
  selectedOverviewItems,
  sortOverviewItemsByCount,
  sortOverviewPlatoonStatsByCount,
  visibleLocationMetrics,
  type OverviewLocationMetricLike,
} from "./overview-primitives";

export function Overview({
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
      filterPeopleByRosterFilters(people, {
        platoonFilter: ui.platoonFilter,
        platoonFilterKeys: ui.platoonFilterKeys,
        locationFilter: ui.locationFilter,
        locationFilterKeys: ui.locationFilterKeys,
        conscriptionFilter: ui.conscriptionFilter,
        conscriptionFilterKeys: ui.conscriptionFilterKeys,
      }),
    [
      people,
      ui.conscriptionFilter,
      ui.conscriptionFilterKeys,
      ui.locationFilter,
      ui.locationFilterKeys,
      ui.platoonFilter,
      ui.platoonFilterKeys,
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
                "grid min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel",
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
                "grid min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel",
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
                "grid min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel",
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
                "grid min-w-0 overflow-hidden rounded-2xl border border-line bg-bg-panel",
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

