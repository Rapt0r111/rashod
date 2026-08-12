import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Reference directory UI contract", () => {
  it("exposes a dedicated page with responsive navigation and its own scroll container", () => {
    const admin = read("src/features/roster/components/admin-panel.tsx");
    const page = read("src/app/references/page.tsx");

    expect(page).toContain("references:manage");
    expect(page).toContain("getPostgresSnapshot");
    expect(admin).toContain('layout === "page"');
    expect(admin).toContain("h-dvh max-h-dvh min-h-0 overflow-y-auto overscroll-contain");
    expect(admin).toContain("lg:grid-cols-[260px_minmax(0,1fr)]");
  });

  it("does not accept client-supplied isSystem on location or platoon writes", () => {
    const locations = read("src/app/api/locations/route.ts");
    const platoons = read("src/app/api/platoons/route.ts");
    const locationAdmin = read("src/features/roster/components/admin/location-admin.tsx");
    const platoonAdmin = read("src/features/roster/components/admin/platoon-admin.tsx");

    expect(locations).not.toContain("isSystem");
    expect(platoons).not.toContain("isSystem");
    expect(locationAdmin).not.toContain("isSystem: editing");
    expect(platoonAdmin).not.toContain("isSystem: editing");
  });

  it("makes the active reference tab explicit beyond color", () => {
    const admin = read("src/features/roster/components/admin-panel.tsx");

    expect(admin).toContain('aria-current={selected ? "page" : undefined}');
    expect(admin).toContain("aria-pressed={selected}");
    expect(admin).toContain("<CheckIcon size={17}");
  });
});
