import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ZgtSelectField } from "@/features/zgt/ui";

describe("ZgtSelectField", () => {
  it("uses the shared custom listbox instead of a native select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <ZgtSelectField label="Статус" value="storage" onChange={onChange}>
        <option value="storage">На складе</option>
        <option value="in_use">Выдан</option>
      </ZgtSelectField>,
    );
    expect(container.querySelector("select")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Статус" }));
    await user.click(screen.getByRole("option", { name: "Выдан" }));
    expect(onChange).toHaveBeenCalledWith("in_use");
  });
});
