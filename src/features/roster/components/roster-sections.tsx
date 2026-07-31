import type { Dispatch } from "react";
import { useCallback, useEffect, useMemo } from "react";
import { CollapsibleFilter } from "@/components/collapsible-filter";
import type { LocationOption, Person, Platoon } from "../types";
import type { Action, State } from "../state";
import {
  countPresent,
  conscriptionOptions,
  peopleForPlatoon,
  selectedFilterKeys,
} from "../utils";
import { locationsAndCustom, presentLocationKeys } from "../roster-metrics";
import { sortListItems } from "@/components/list-utils";
import type { SelectionProps } from "./selection-types";
import { PersonCard, RosterRow } from "./person-views";
import {
  EmptyState,
  FilterPills,
  SectionHeader,
} from "./overview-primitives";

export { EmptyState, SectionHeader };

export function AllPlatoons({
  state,
  people,
  platoons,
  locations,
  onLocation,
  canWrite,
  dispatch,
  selection,
}: {
  state: State;
  people: Person[];
  platoons: Platoon[];
  locations: LocationOption[];
  onLocation: (person: Person, to: string) => void;
  canWrite: boolean;
  dispatch: Dispatch<Action>;
  selection: SelectionProps;
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

  const presentKeys = useMemo(
    () => presentLocationKeys(locations),
    [locations],
  );

  // Memoize visible groups with present counts
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
            inRota: countPresent(group, presentKeys),
          };
        })
        .filter((item) => item.group.length > 0),
    [
      people,
      presentKeys,
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
  const visibleIds = useMemo(
    () => visibleGroups.flatMap((item) => item.group.map((person) => person.id)),
    [visibleGroups],
  );
  useEffect(() => {
    selection.onVisiblePeopleChange?.(visibleIds);
  }, [selection, visibleIds]);

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
                pending={selection.pendingIds.has(person.id)}
                canWrite={canWrite}
                selected={selection.selectedIds.has(person.id)}
                onToggleSelect={selection.onToggleSelect}
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

export function PlatoonSection({
  state,
  platoon,
  people,
  locations,
  canWrite,
  dispatch,
  selection,
}: {
  state: State;
  platoon: Platoon;
  people: Person[];
  locations: LocationOption[];
  onLocation: (person: Person, to: string) => void;
  canWrite: boolean;
  dispatch: Dispatch<Action>;
  selection: SelectionProps;
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
  const visibleIds = useMemo(() => filtered.map((person) => person.id), [filtered]);
  useEffect(() => {
    selection.onVisiblePeopleChange?.(visibleIds);
  }, [selection, visibleIds]);

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
            selected={selection.selectedIds.has(person.id)}
            onToggleSelect={selection.onToggleSelect}
            onClick={handleOpenSheet}
          />
        ))}
      </div>
      {filtered.length === 0 && <EmptyState />}
    </section>
  );
}

