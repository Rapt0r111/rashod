import type { Snapshot, ToastChange } from "./types";
import type { ListSortState } from "@/components/list-utils";

export type UiState = {
  activeSection: string;
  searchQuery: string;
  locationFilter: string | null;
  locationFilterKeys: string[] | null;
  conscriptionFilter: string | null;
  conscriptionFilterKeys: string[] | null;
  platoonFilter: string | null;
  platoonFilterKeys: string[] | null;
  editingPersonId: string | null;
  isLocationSheetOpen: boolean;
  isHistoryPanelOpen: boolean;
  hasUnseenHistory: boolean;
  isAdminOpen: boolean;
  sort: ListSortState;
};

export type State = Snapshot & { ui: UiState; flashPersonId: string | null };

export type Action =
  | { type: "snapshot"; snapshot: Snapshot; preserveUi?: boolean }
  | {
      type: "patchPeopleLocations";
      patches: Array<{ personId: string; location: string }>;
    }
  | { type: "section"; key: string }
  | { type: "search"; value: string }
  | { type: "locationFilter"; value: string | null }
  | { type: "locationFilters"; value: string[] | null }
  | { type: "toggleLocationFilter"; value: string }
  | { type: "conscriptionFilter"; value: string | null }
  | { type: "conscriptionFilters"; value: string[] | null }
  | { type: "toggleConscriptionFilter"; value: string }
  | { type: "platoonFilter"; value: string | null }
  | { type: "platoonFilters"; value: string[] | null }
  | { type: "togglePlatoonFilter"; value: string }
  | { type: "openSheet"; personId: string }
  | { type: "closeSheet" }
  | { type: "history"; open: boolean }
  | { type: "admin"; open: boolean }
  | { type: "flash"; personId: string | null }
  | { type: "sort"; value: ListSortState };

export const initialUi: UiState = {
  activeSection: "overview",
  searchQuery: "",
  locationFilter: null,
  locationFilterKeys: null,
  conscriptionFilter: null,
  conscriptionFilterKeys: null,
  platoonFilter: null,
  platoonFilterKeys: null,
  editingPersonId: null,
  isLocationSheetOpen: false,
  isHistoryPanelOpen: false,
  hasUnseenHistory: false,
  isAdminOpen: false,
  sort: { key: "alpha", direction: "asc" },
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "snapshot":
      return {
        ...action.snapshot,
        flashPersonId: state?.flashPersonId ?? null,
        ui: action.preserveUi ? state.ui : initialUi,
      };
    case "patchPeopleLocations": {
      if (!action.patches.length) return state;
      const map = new Map(
        action.patches.map((patch) => [patch.personId, patch.location]),
      );
      const now = Date.now();
      return {
        ...state,
        people: state.people.map((person) => {
          const location = map.get(person.id);
          return location !== undefined
            ? { ...person, location, updatedAt: now }
            : person;
        }),
      };
    }
    case "section":
      return {
        ...state,
        ui: {
          ...state.ui,
          activeSection: action.key,
          locationFilter: null,
          locationFilterKeys: null,
          conscriptionFilter: null,
          conscriptionFilterKeys: null,
          platoonFilter: null,
          platoonFilterKeys: null,
        },
      };
    case "search":
      return { ...state, ui: { ...state.ui, searchQuery: action.value } };
    case "locationFilter":
      return { ...state, ui: { ...state.ui, locationFilter: action.value, locationFilterKeys: null } };
    case "locationFilters":
      {
        const keys = normalizeFilterKeys(action.value);
        return {
          ...state,
          ui: {
            ...state.ui,
            locationFilter: keys?.length === 1 ? keys[0] : null,
            locationFilterKeys: keys,
          },
        };
      }
    case "toggleLocationFilter":
      {
        const keys = toggleFilterKey(
          state.ui.locationFilterKeys ?? (state.ui.locationFilter ? [state.ui.locationFilter] : null),
          action.value,
        );
        return {
          ...state,
          ui: {
            ...state.ui,
            locationFilter: keys?.length === 1 ? keys[0] : null,
            locationFilterKeys: keys,
          },
        };
      }
    case "conscriptionFilter":
      return {
        ...state,
        ui: {
          ...state.ui,
          conscriptionFilter: action.value,
          conscriptionFilterKeys: action.value ? [action.value] : null,
        },
      };
    case "conscriptionFilters":
      {
        const keys = normalizeFilterKeys(action.value);
        return {
          ...state,
          ui: {
            ...state.ui,
            conscriptionFilter: keys?.length === 1 ? keys[0] : null,
            conscriptionFilterKeys: keys,
          },
        };
      }
    case "toggleConscriptionFilter":
      {
        const keys = toggleFilterKey(
          state.ui.conscriptionFilterKeys ?? (state.ui.conscriptionFilter ? [state.ui.conscriptionFilter] : null),
          action.value,
        );
        return {
          ...state,
          ui: {
            ...state.ui,
            conscriptionFilter: keys?.length === 1 ? keys[0] : null,
            conscriptionFilterKeys: keys,
          },
        };
      }
    case "platoonFilter":
      return {
        ...state,
        ui: {
          ...state.ui,
          platoonFilter: action.value,
          platoonFilterKeys: action.value ? [action.value] : null,
        },
      };
    case "platoonFilters":
      {
        const keys = normalizeFilterKeys(action.value);
        return {
          ...state,
          ui: {
            ...state.ui,
            platoonFilter: keys?.length === 1 ? keys[0] : null,
            platoonFilterKeys: keys,
          },
        };
      }
    case "togglePlatoonFilter":
      {
        const keys = toggleFilterKey(
          state.ui.platoonFilterKeys ?? (state.ui.platoonFilter ? [state.ui.platoonFilter] : null),
          action.value,
        );
        return {
          ...state,
          ui: {
            ...state.ui,
            platoonFilter: keys?.length === 1 ? keys[0] : null,
            platoonFilterKeys: keys,
          },
        };
      }
    case "openSheet":
      return {
        ...state,
        ui: {
          ...state.ui,
          editingPersonId: action.personId,
          isLocationSheetOpen: true,
        },
      };
    case "closeSheet":
      return {
        ...state,
        ui: { ...state.ui, editingPersonId: null, isLocationSheetOpen: false },
      };
    case "history":
      return {
        ...state,
        ui: {
          ...state.ui,
          isHistoryPanelOpen: action.open,
          hasUnseenHistory: action.open ? false : state.ui.hasUnseenHistory,
        },
      };
    case "admin":
      return { ...state, ui: { ...state.ui, isAdminOpen: action.open } };
    case "flash":
      return { ...state, flashPersonId: action.personId };
    case "sort":
      return { ...state, ui: { ...state.ui, sort: action.value } };
  }
}

function normalizeFilterKeys(value: string[] | null) {
  const keys = [...new Set((value ?? []).map((item) => item.trim()).filter(Boolean))];
  return keys.length > 0 ? keys : null;
}

function toggleFilterKey(current: string[] | null, value: string) {
  const keys = current ?? [];
  return normalizeFilterKeys(
    keys.includes(value) ? keys.filter((item) => item !== value) : [...keys, value],
  );
}

export type ToastBatch = {
  changes: Map<string, ToastChange>;
  expiresAt: number;
} | null;
