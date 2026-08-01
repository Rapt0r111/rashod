import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScheduleApp } from "@/features/schedule/ScheduleApp";
import type { ScheduleSnapshot } from "@/features/schedule/types";

const initialSnapshot: ScheduleSnapshot = {
  from: "2026-08-05",
  to: "2026-08-05",
  dates: ["2026-08-05"],
  people: [{
    id: "person-1",
    platoonId: "platoon-1",
    rank: "ефрейтор",
    name: "Кистаев Семен Евгеньевич",
    conscriptionNumber: null,
    location: "rota",
    sortOrder: 1,
    createdAt: 0,
    updatedAt: 0,
  }],
  platoons: [{ id: "platoon-1", key: "one", label: "1 взвод", sortOrder: 1, isSystem: true }],
  groups: [{
    id: "group-1",
    templateId: "template-1",
    name: "Дежурный по роте",
    notes: "",
    enabled: true,
    sortOrder: 1,
    createdAt: 0,
    updatedAt: 0,
  }],
  groupRules: {
    "group-1": {
      id: "rule-1",
      groupId: "group-1",
      enabledPlatoons: [],
      peoplePerDay: 1,
      assignmentQuotas: [],
      autoRotate: true,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      priorityMode: "oldest",
      overlapPolicy: "exclusive",
    },
  },
  assignments: [],
};

const assignedSnapshot: ScheduleSnapshot = {
  ...initialSnapshot,
  assignments: [{
    id: "assignment-1",
    groupId: "group-1",
    personId: "person-1",
    personName: "Кистаев Семен Евгеньевич",
    personRank: "ефрейтор",
    personConscriptionNumber: null,
    assignedDate: "2026-08-05",
    source: "manual",
    conflictState: "clear",
    conflicts: [],
    createdAt: 1,
  }],
};

const groupFilteredSnapshot: ScheduleSnapshot = {
  ...initialSnapshot,
  people: [
    ...initialSnapshot.people,
    { ...initialSnapshot.people[0], id: "person-2", name: "Ситников Иван Алексеевич", sortOrder: 2 },
  ],
  groups: [
    ...initialSnapshot.groups,
    { ...initialSnapshot.groups[0], id: "group-2", name: "Водитель", sortOrder: 2 },
  ],
  groupRules: {
    ...initialSnapshot.groupRules,
    "group-2": { ...initialSnapshot.groupRules["group-1"], id: "rule-2", groupId: "group-2" },
  },
  assignments: [{
    id: "assignment-2",
    groupId: "group-2",
    personId: "person-2",
    personName: "Ситников Иван Алексеевич",
    personRank: "ефрейтор",
    personConscriptionNumber: null,
    assignedDate: "2026-08-05",
    source: "manual",
    conflictState: "clear",
    conflicts: [],
    createdAt: 1,
  }],
};

function renderSchedule(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  render(<ScheduleApp initialSnapshot={initialSnapshot} canWrite onOpenGroups={vi.fn()} />);
  const editButton = screen.getAllByRole("button", { name: /Редактировать Кистаев/ })
    .find((element) => element.tagName === "BUTTON");
  if (!editButton) throw new Error("Schedule edit button not found");
  fireEvent.click(editButton);
  fireEvent.click(screen.getByRole("button", { name: "Назначить вручную" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ScheduleApp assignment feedback", () => {
  it("updates the selected modal state after a successful assignment", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response("{}", { status: 200 });
      return new Response(JSON.stringify(assignedSnapshot), { status: 200 });
    });

    renderSchedule(fetchMock);

    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Без конфликтов")).toBeInTheDocument());
    expect(within(dialog).getByText("1", { selector: "strong" })).toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Ручное назначение добавлено.");
  });

  it("shows the server rejection inside the modal without inventing an assignment", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ error: "GROUP_ASSIGNMENT_OVERFILLED" }), { status: 400 });
      }
      return new Response(JSON.stringify(initialSnapshot), { status: 200 });
    });

    renderSchedule(fetchMock);

    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("уже назначено нужное количество"));
    expect(within(dialog).getByText("Нет назначений")).toBeInTheDocument();
  });
});

describe("ScheduleApp filters", () => {
  it("shows only people assigned to the selected group", () => {
    render(<ScheduleApp initialSnapshot={groupFilteredSnapshot} canWrite={false} onOpenGroups={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Фильтр по группе" }));
    fireEvent.click(screen.getByRole("option", { name: "Водитель" }));

    expect(screen.getAllByText("Ситников Иван Алексеевич").length).toBeGreaterThan(0);
    expect(screen.queryByText("Кистаев Семен Евгеньевич")).not.toBeInTheDocument();
  });
});
