import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(process.cwd(), "src/app");
const stylesRoot = resolve(appRoot, "styles");

describe("Tailwind CSS migration contract", () => {
  it("keeps Tailwind v4 as the single global style entrypoint", () => {
    const globals = readFileSync(resolve(appRoot, "globals.css"), "utf8");

    expect(globals).toContain('@import "tailwindcss";');
    expect(globals).toContain("@theme inline");
    expect(globals).toContain("@layer base");
    expect(globals).not.toContain("@layer components");
    expect(globals).not.toContain("Migrated from");
    expect(globals).not.toContain("@tailwind base");
    expect(globals).not.toMatch(/@import\s+["']\.\/styles\/(theme|shell|list-controls|roster|admin|groups|tasks|responsive)\.css/);
  });

  it("does not leave deleted legacy style entrypoints behind", () => {
    expect(readdirSync(stylesRoot).sort()).toEqual(["fonts.css"]);
    for (const name of ["theme.css", "shell.css", "list-controls.css", "roster.css", "admin.css", "groups.css", "tasks.css", "responsive.css"]) {
      expect(existsSync(resolve(stylesRoot, name))).toBe(false);
    }
  });
});
