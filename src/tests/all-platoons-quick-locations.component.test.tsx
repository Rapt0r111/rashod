import { useReducer } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OperatorBar } from "@/features/roster/components/operator-bar";
import { AllPlatoons } from "@/features/roster/components/roster-sections";
import { cloneDefaultOverviewSettings } from "@/features/roster/overview-settings";
import { initialUi, reducer, type State } from "@/features/roster/state";
import type { LocationOption, Person, Platoon } from "@/features/roster/types";

const locations: LocationOption[] = [
  {
    id: "rota",
    key: "rota",
    label: "Рота",
    colorToken: "green",
    isQuick: true,
    quickCode: "Р",
    isSystem: true,
    countsAsPresent: true,
    sortOrder: 10,
  },
  {
    id: "naryad",
    key: "naryad",
    label: "Наряд",
    colorToken: "cyan",
    isQuick: true,
    quickCode: "Н",
    isSystem: true,
    countsAsPresent: false,
    sortOrder: 20,
  },
  {
    id: "technopark",
    key: "technopark",
    label: "Технопарк",
    colorToken: "blue",
    isQuick: true,
    quickCode: "Т",
    isSystem: true,
    countsAsPresent: false,
    sortOrder: 30,
  },
  {
    id: "otpusk",
    key: "otpusk",
    label: "Отпуск",
    colorToken: "neutral",
    isQuick: false,
    quickCode: null,
    isSystem: true,
    countsAsPresent: false,
    sortOrder: 80,
  },
];

const platoons: Platoon[] = [
  { id: "plt-vz1", key: "vz1", label: "1 взвод", sortOrder: 10, isSystem: true },
];

const people: Person[] = [
  {
    id: "person-1",
    platoonId: "plt-vz1",
    rank: "рядовой",
    name: "Иванов Иван Иванович",
    conscriptionNumber: null,
    location: "rota",
    sortOrder: 1,
    createdAt: 1,
    updatedAt: 1,
  },
];

describe("All Platoons quick locations", () => {
  it("shows empty isQuick places on the command strip", () => {
    render(
      <OperatorBar
        people={people}
        total={1}
        locations={locations}
        locationGroups={[]}
        query=""
        sort={{ key: "alpha", direction: "asc" }}
        onQueryChange={() => undefined}
        onSortChange={() => undefined}
        onLocationFilter={() => undefined}
        onResetFilters={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Показать людей в месте: Рота" })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Показать людей в месте: Наряд" })).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: "Показать людей в месте: Технопарк" })).toHaveTextContent("0");
    expect(screen.queryByRole("button", { name: "Показать людей в месте: Отпуск" })).not.toBeInTheDocument();
  });

  it("keeps empty isQuick places in the All Platoons location filter", async () => {
    const user = userEvent.setup();
    render(
      <AllPlatoons
        state={{
          people,
          platoons,
          locations,
          locationGroups: [],
          overviewSettings: cloneDefaultOverviewSettings(),
          changeLog: [],
          serverTime: 1,
          ui: initialUi,
          flashPersonId: null,
        }}
        people={people}
        platoons={platoons}
        locations={locations}
        onLocation={() => undefined}
        canWrite
        dispatch={vi.fn()}
        selection={{
          selectedIds: new Set(),
          pendingIds: new Set(),
          onToggleSelect: () => undefined,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Фильтры/ }));
    const locationFilter = screen.getByLabelText("Локация");
    expect(locationFilter).toHaveTextContent("Наряд");
    expect(locationFilter).toHaveTextContent("Технопарк");
    expect(locationFilter).not.toHaveTextContent("Отпуск");
  });

  it("keeps a compact people table without a redundant platoon column", () => {
    render(
      <AllPlatoons
        state={{
          people,
          platoons,
          locations,
          locationGroups: [],
          overviewSettings: cloneDefaultOverviewSettings(),
          changeLog: [],
          serverTime: 1,
          ui: initialUi,
          flashPersonId: null,
        }}
        people={people}
        platoons={platoons}
        locations={locations}
        onLocation={() => undefined}
        canWrite
        dispatch={vi.fn()}
        selection={{
          selectedIds: new Set(),
          pendingIds: new Set(),
          onToggleSelect: () => undefined,
        }}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Звание" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Фамилия" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Место" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Назначить" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Взвод" })).not.toBeInTheDocument();
    expect(screen.getByText("Иванов И.И.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Звание" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Взвод" })).toHaveAttribute("aria-pressed", "false");
  });

  it("lets the operator hide rank and show platoon columns", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [state, dispatch] = useReducer(reducer, {
        people,
        platoons,
        locations,
        locationGroups: [],
        overviewSettings: cloneDefaultOverviewSettings(),
        changeLog: [],
        serverTime: 1,
        ui: initialUi,
        flashPersonId: null,
      } satisfies State);
      return (
        <AllPlatoons
          state={state}
          people={people}
          platoons={platoons}
          locations={locations}
          onLocation={() => undefined}
          canWrite
          dispatch={dispatch}
          selection={{
            selectedIds: new Set(),
            pendingIds: new Set(),
            onToggleSelect: () => undefined,
          }}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Звание" }));
    expect(screen.queryByRole("columnheader", { name: "Звание" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Фамилия" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Взвод" }));
    expect(screen.getByRole("columnheader", { name: "Взвод" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1 взвод" })).toBeInTheDocument();
  });
});
