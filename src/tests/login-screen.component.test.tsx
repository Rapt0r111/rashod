import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginScreen } from "@/features/auth/LoginScreen";

describe("LoginScreen", () => {
  it("renders an accessible credential form", () => {
    const { container } = render(<LoginScreen setupRequired={false} />);
    expect(container.querySelector('input[autocomplete="username"]')).toBeRequired();
    expect(container.querySelector('input[autocomplete="current-password"]')).toBeRequired();
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("does not expose the login form before the first administrator exists", () => {
    const { container } = render(<LoginScreen setupRequired />);
    expect(container.querySelector("form")).not.toBeInTheDocument();
    expect(container.querySelector("code")).toBeInTheDocument();
  });
});
