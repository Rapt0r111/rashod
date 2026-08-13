import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel, settingsSavedRevision } from "@/features/groups/components/settings-panel";
import type { DutyGroupSnapshot } from "@/features/groups/types";

function snapshot(id: string, name: string, notes = ""): DutyGroupSnapshot {
  return {
    group: {
      id,
      templateId: "tpl",
      name,
      notes,
      enabled: true,
      sortOrder: 1,
      createdAt: 1,
      updatedAt: 1,
    },
    template: {
      id: "tpl",
      key: "duty",
      name: "Наряд",
      colorToken: "cyan",
      icon: "shield",
      defaultPeoplePerDay: 1,
      defaultActiveDays: [1, 2, 3, 4, 5],
      sortOrder: 1,
      isSystem: true,
      createdAt: 1,
    },
    rule: {
      id: "rule",
      groupId: id,
      enabledPlatoons: [],
      peoplePerDay: 2,
      assignmentQuotas: [],
      autoRotate: true,
      activeDays: [1, 2, 3, 4, 5],
      priorityMode: "oldest",
      overlapPolicy: "exclusive",
    },
    todayAssignments: [],
    week: [],
    exclusions: [],
    availablePeople: [],
    availablePeopleByDate: {},
    candidatePeople: [],
    candidatePlatoons: [],
    stats: { assignedToday: 0, availableToday: 0, conflictsToday: 0, weekAssignments: 0 },
  };
}

describe("SettingsPanel", () => {
  it("loads the next group's name without a remount key", () => {
    const { rerender } = render(
      <SettingsPanel
        item={snapshot("g1", "Первая")}
        platoons={[]}
        isBusy={false}
        onSave={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Первая")).toBeInTheDocument();
    rerender(
      <SettingsPanel
        item={snapshot("g2", "Вторая", "заметка")}
        platoons={[]}
        isBusy={false}
        onSave={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Вторая")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Первая")).not.toBeInTheDocument();
  });

  it("keeps a draft when SSE sends a new snapshot with the same saved revision", async () => {
    const user = userEvent.setup();
    const first = snapshot("g1", "Первая");
    const { rerender } = render(
      <SettingsPanel
        item={first}
        platoons={[]}
        isBusy={false}
        onSave={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const input = screen.getByDisplayValue("Первая");
    await user.clear(input);
    await user.type(input, "Черновик");
    const refreshed: DutyGroupSnapshot = {
      ...first,
      rule: { ...first.rule, enabledPlatoons: [...first.rule.enabledPlatoons], activeDays: [...first.rule.activeDays] },
    };
    expect(settingsSavedRevision(refreshed)).toBe(settingsSavedRevision(first));
    rerender(
      <SettingsPanel
        item={refreshed}
        platoons={[]}
        isBusy={false}
        onSave={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Черновик")).toBeInTheDocument();
  });
});
