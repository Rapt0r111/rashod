import type { Dispatch } from "react";
import { useCallback, useMemo } from "react";
import type { LocationOption, Person, Platoon } from "../types";
import type { Action, State } from "../state";
import { filterPeople } from "../utils";
import { sortListItems } from "@/components/list-utils";
import { RosterRow } from "./person-views";
import { Overview } from "./overview-section";
import {
  AllPlatoons,
  EmptyState,
  PlatoonSection,
  SectionHeader,
} from "./roster-sections";

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

