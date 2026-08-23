import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BatchLocationSheet, LocationSheet } from "@/features/roster/components/dialogs";
import type { LocationOption, Person } from "@/features/roster/types";

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
];

const person: Person = {
  id: "person-1",
  platoonId: "platoon-vz1",
  rank: "рядовой",
  name: "Иванов Иван Иванович",
  conscriptionNumber: null,
  location: "rota",
  sortOrder: 1,
  createdAt: 1,
  updatedAt: 1,
};

describe("LocationSheet typed Другое place", () => {
  it("lists catalog places and submits the typed string, not a catalog key", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <LocationSheet
        person={person}
        locations={locations}
        open
        onClose={() => undefined}
        onPick={onPick}
      />,
    );

    expect(screen.getByRole("button", { name: "Рота" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Наряд" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Другое" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Наряд" }));
    expect(onPick).toHaveBeenCalledWith(person, "naryad");
    onPick.mockClear();

    await user.click(screen.getByRole("button", { name: "Другое" }));
    const input = screen.getByRole("textbox", { name: "Другое место" });
    const submit = screen.getByRole("button", { name: "Перевести" });
    expect(submit).toBeDisabled();

    await user.type(input, "   ");
    expect(submit).toBeDisabled();
    await user.clear(input);
    await user.type(input, "  Полевой госпиталь  ");
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(person, "Полевой госпиталь");
    expect(onPick.mock.calls[0][1]).not.toBe("rota");
    expect(onPick.mock.calls[0][1]).not.toBe("naryad");
    expect(locations.some((location) => location.key === onPick.mock.calls[0][1])).toBe(false);
  });
});

describe("BatchLocationSheet typed Другое place", () => {
  it("keeps catalog buttons and submits the typed name", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <BatchLocationSheet
        count={3}
        locations={locations}
        open
        onClose={() => undefined}
        onPick={onPick}
      />,
    );

    expect(screen.getByRole("button", { name: "Рота" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Наряд" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Другое" }));
    await user.type(screen.getByRole("textbox", { name: "Другое место" }), "КПП-3");
    await user.click(screen.getByRole("button", { name: "Перевести" }));

    expect(onPick).toHaveBeenCalledWith("КПП-3");
    expect(locations.some((location) => location.key === "КПП-3")).toBe(false);
  });
});
