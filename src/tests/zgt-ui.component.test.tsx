import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ZgtCheckbox,
  ZgtConfirmDialog,
  ZgtPersonSearch,
  ZgtToggleChip,
} from "@/features/zgt/ui";

vi.mock("@/features/zgt/api", () => ({
  searchZgtPeople: vi.fn(),
}));

import { searchZgtPeople } from "@/features/zgt/api";

const searchMock = vi.mocked(searchZgtPeople);

describe("ZGT shared controls", () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it("renders a styled checkbox without a native control", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <ZgtCheckbox checked={false} onChange={onChange} label="Выбрать строку" />,
    );
    expect(container.querySelector("input")).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Выбрать строку" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles a chip with a visible label", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ZgtToggleChip checked={false} onChange={onChange} label="Камера" />);
    await user.click(screen.getByRole("checkbox", { name: "Камера" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("asks for delete confirmation in-app", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ZgtConfirmDialog
        open
        title="Удалить технику?"
        text="«Ноутбук» будет удалена без возможности отмены."
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Удалить технику?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("shows the selected person by name, not by id", async () => {
    const user = userEvent.setup();
    searchMock.mockResolvedValue([
      {
        id: "person-long-id-should-not-show",
        name: "Иванов",
        rank: "ряд.",
        platoonLabel: "1 взвод",
        conscriptionNumber: null,
        location: "unit",
        locationLabel: "В части",
        position: null,
        unit: null,
      },
    ]);
    const onSelect = vi.fn();
    function Harness() {
      const [query, setQuery] = useState("");
      const [selectedId, setSelectedId] = useState<string | null>(null);
      return (
        <ZgtPersonSearch
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedId}
          onSelect={(person) => {
            setSelectedId(person.id);
            onSelect(person);
          }}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole("combobox"), "Ива");
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ряд\. Иванов/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /ряд\. Иванов/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "person-long-id-should-not-show" }),
    );
    expect(screen.getByText(/Выбран:/)).toHaveTextContent("ряд. Иванов");
    expect(screen.queryByText(/person-long-id/)).toBeNull();
  });

  it("explains when the roster search is empty", async () => {
    const user = userEvent.setup();
    searchMock.mockResolvedValue([]);
    function Harness() {
      const [query, setQuery] = useState("");
      return (
        <ZgtPersonSearch
          query={query}
          onQueryChange={setQuery}
          selectedId={null}
          onSelect={vi.fn()}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole("combobox"), "Неттакого");
    await waitFor(() => {
      expect(screen.getByText(/Никого не нашли/)).toBeInTheDocument();
    });
  });
});
