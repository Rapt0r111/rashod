import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const overviewSource = readFileSync(
  resolve(process.cwd(), "src/features/roster/components/main-content.tsx"),
  "utf8",
);

describe("Overview responsive layout contract", () => {
  it("keeps location distribution actions content-sized", () => {
    expect(overviewSource).toContain(
      "grid-cols-[minmax(0,1.05fr)_minmax(100px,1fr)_auto]",
    );
    expect(overviewSource).not.toContain(
      "grid-cols-[minmax(100px,1fr)_minmax(80px,1fr)_52px]",
    );
  });

  it("moves the distribution bar below the label on phone widths", () => {
    expect(overviewSource).toContain(
      "max-[720px]:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(overviewSource).toContain("max-[720px]:row-start-2");
  });

  it("keeps overview motion short and reduced-motion safe", () => {
    expect(overviewSource).not.toContain("duration-500");
    expect(overviewSource).toContain("duration-200 motion-reduce:transition-none");
  });
});
