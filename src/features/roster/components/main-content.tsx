import type { Dispatch } from "react";
import { useCallback, useEffect, useMemo } from "react";
import type { LocationOption, Person, Platoon } from "../types";
import type { Action, State } from "../state";
import { filterPeople } from "../utils";
import { sortListItems } from "@/components/list-utils";
import { RosterColumnToggles, RosterRow, RosterTable } from "./person-views";
import { Overview } from "./overview-section";
import {
  AllPlatoons,
  EmptyState,
  PlatoonSection,
  SectionHeader,
} from "./roster-sections";
import type { SelectionProps } from "./selection-types";

export type { SelectionProps };

export function MainContent(props: {
  state: State;
  people: Person[];
  allPeople: Person[];
  platoons: Platoon[];
  locations: LocationOption[];
  onSection: (key: string) => void;
  onLocationFilter: (keys: string[]) => void;
  onPlatoonLocation?: (platoonId: string, locationKey: string) => void;
  onCustomizeOverview: () => void;
  onLocation: (person: Person, to: string) => void;
  canWrite: boolean;
  canCustomizeOverview: boolean;
  dispatch: Dispatch<Action>;
  selection: SelectionProps;
}) {
  const { state, people, allPeople, platoons, locations, selection } = props;
  if (state.ui.searchQuery.trim())
    return (
      <SearchResults
        query={state.ui.searchQuery}
        state={state}
        people={allPeople}
        platoons={platoons}
        locations={locations}
        onLocation={props.onLocation}
        canWrite={props.canWrite}
        dispatch={props.dispatch}
        selection={selection}
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
        onPlatoonLocation={props.onPlatoonLocation}
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
        canWrite={props.canWrite}
        dispatch={props.dispatch}
        selection={selection}
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
      selection={selection}
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
  canWrite,
  dispatch,
  selection,
}: {
  query: string;
  state: State;
  people: Person[];
  platoons: Platoon[];
  locations: LocationOption[];
  onLocation: (person: Person, to: string) => void;
  canWrite: boolean;
  dispatch: Dispatch<Action>;
  selection: SelectionProps;
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

  const resultIds = useMemo(() => results.map((person) => person.id), [results]);
  useEffect(() => {
    selection.onVisiblePeopleChange?.(resultIds);
  }, [resultIds, selection]);

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-[1640px] gap-4.5 max-[1180px]:gap-4">
      <SectionHeader
        title="Результаты поиска"
        subtitle={`${results.length} ${results.length === 1 ? "человек" : "человек найдено"} по запросу «${query}»`}
        action={
          <RosterColumnToggles
            showRank={state.ui.showRankColumn}
            showPlatoon={state.ui.showPlatoonColumn}
            onToggle={(column) => dispatch({ type: "toggleRosterColumn", column })}
          />
        }
      />
      {results.length > 0 ? (
        <RosterTable
          showRank={state.ui.showRankColumn}
          showContext={state.ui.showPlatoonColumn}
        >
          {results.map((person) => (
            <RosterRow
              key={person.id}
              person={person}
              locations={locations}
              contextLabel={platoonLabels.get(person.platoonId)}
              flash={state.flashPersonId === person.id}
              pending={selection.pendingIds.has(person.id)}
              canWrite={canWrite}
              selected={selection.selectedIds.has(person.id)}
              onToggleSelect={selection.onToggleSelect}
              onLocation={onLocation}
              onMore={handleOpenSheet}
            />
          ))}
        </RosterTable>
      ) : (
        <EmptyState />
      )}
    </section>
  );
}
