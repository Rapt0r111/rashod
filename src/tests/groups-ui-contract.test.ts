import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  resolve(process.cwd(), "src/features/WorkspaceApp.tsx"),
  "utf8",
);
const groupsSource = readFileSync(
  resolve(process.cwd(), "src/features/groups/GroupsApp.tsx"),
  "utf8",
);
const groupsApiSource = readFileSync(
  resolve(process.cwd(), "src/features/groups/api.ts"),
  "utf8",
);
const searchSource = readFileSync(
  resolve(process.cwd(), "src/components/search-sort-control.tsx"),
  "utf8",
);

describe("Groups responsive UI contract", () => {
  it("gives the standalone groups route its own scroll container", () => {
    expect(workspaceSource).toContain(
      'className="h-dvh min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-bg-base"',
    );
  });

  it("uses mobile-first breakpoints for the groups workspace", () => {
    expect(groupsSource).toContain("lg:grid-cols-[minmax(210px,250px)_minmax(0,1fr)]");
    expect(groupsSource).toContain("xl:grid-cols-[minmax(210px,250px)_minmax(0,1fr)_minmax(260px,310px)]");
    expect(groupsSource).toContain("sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7");
    expect(groupsSource).not.toContain("max-[860px]:grid-cols-1");
    expect(groupsSource).not.toContain("max-[520px]:grid-cols-1");
  });

  it("lets the shared search control shrink inside narrow panels", () => {
    expect(searchSource).toContain("min-w-0 flex-1 basis-full");
    expect(searchSource).toContain("w-full min-w-0 shrink-0");
    expect(searchSource).not.toContain("min-w-45 flex-1 basis-65");
  });

  it("contains the group toolbar title and keeps actions in an adaptive grid", () => {
    const toolbarSource = groupsSource.slice(
      groupsSource.indexOf("function GroupToolbar"),
      groupsSource.indexOf("function WeekStrip"),
    );

    expect(toolbarSource).toContain(
      "min-[1800px]:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(toolbarSource).toContain(
      "grid-cols-[repeat(auto-fit,minmax(140px,1fr))]",
    );
    expect(toolbarSource).toContain("min-w-0");
    expect(toolbarSource).not.toContain("min-[1100px]:grid-cols");
  });

  it("handles mutation API errors inside the click callback", () => {
    const mutationSource = groupsSource.slice(
      groupsSource.indexOf("async function run("),
      groupsSource.indexOf("async function assignPerson("),
    );

    expect(mutationSource).toContain("catch (error) {");
    expect(mutationSource).toContain("setError(getGroupErrorMessage(error, message));");
    expect(mutationSource).not.toContain("throw err");
  });

  it("offers an explicit recovery after a failed Groups action", () => {
    expect(groupsSource).toContain('role="alert"');
    expect(groupsSource).toContain("Обновить данные");
    expect(groupsSource).toContain("void refresh(true)");
  });

  it("makes mutation results and destructive actions explicit", () => {
    expect(groupsSource).toContain("setNotice(successMessage)");
    expect(groupsSource).toContain('role="status"');
    expect(groupsSource).toContain("Удалить группу?");
    expect(groupsSource).toContain("без возможности отмены");
    expect(groupsSource).toContain("Назначить с конфликтом");
    expect(groupsSource).not.toContain("window.confirm");
  });

  it("guards duplicate mutations and ignores stale refresh snapshots", () => {
    expect(groupsSource).toContain("const isMutatingRef = useRef(false);");
    expect(groupsSource).toContain("if (!canWrite || isMutatingRef.current) return null;");
    expect(groupsSource).toContain("const snapshotRevisionRef = useRef(0);");
    expect(groupsSource).toContain("if (revision === snapshotRevisionRef.current)");
    expect(groupsSource).toContain('err.code === "GROUP_ASSIGNMENT_CONFLICT"');
    expect(groupsSource).toContain("err.conflicts.length > 0");
    expect(groupsSource).toContain("expectedUpdatedAt: activeSnapshot.group.updatedAt");
  });

  it("keeps explicit Groups copy under regression", () => {
    const phrase = (...codes: number[]) => String.fromCodePoint(...codes);
    expect(groupsSource).toContain(phrase(0x417, 0x430, 0x43f, 0x443, 0x441, 0x442, 0x438, 0x442, 0x44c, 0x20, 0x440, 0x43e, 0x442, 0x430, 0x446, 0x438, 0x44e));
  });

  it("does not ship replacement characters or literal unicode escapes", () => {
    for (const source of [groupsSource, groupsApiSource]) {
      expect(source).not.toContain("\uFFFD");
      expect(source).not.toContain("\\u");
    }
  });

  it("keeps no-template and no-candidate states actionable", () => {
    expect(groupsSource).toContain("Нет шаблонов для группы");
    expect(groupsSource).toContain("Нет кандидатов на выбранную дату");
    expect(groupsSource).toContain("Проверьте исключения и правила группы или выберите другую дату.");
  });

  it("bounds editable group text and preserves dialog semantics", () => {
    expect(groupsSource).toContain("maxLength={GROUP_NAME_MAX_LENGTH}");
    expect(groupsSource).toContain("maxLength={GROUP_NOTES_MAX_LENGTH}");
    expect(groupsSource).toContain("maxLength={EXCLUSION_REASON_MAX_LENGTH}");
    expect(groupsSource).toContain('aria-labelledby={titleId}');
    expect(groupsSource).toContain('document.body.style.overflow = "hidden"');
    expect(groupsSource).toContain('placeholder="Выберите человека"');
    expect(groupsSource).not.toContain("peopleOptions[0]?.value");
  });

  it("keeps invalid dates from reaching manual assignment or rotation", () => {
    expect(groupsSource).toContain("const effectiveSelectedDate = selectedDay?.date ?? selectedDate;");
    expect(groupsSource).toContain("selectedAvailablePeople =");
    expect(groupsSource).toContain("availablePeopleByDate[effectiveSelectedDate]");
    expect(groupsSource).toContain("rotateGroup(activeSnapshot.group.id, effectiveSelectedDate)");
    expect(groupsSource).toContain("effectiveSelectedDate,\n        allowConflict");
  });

  it("labels inactive week days without relying on opacity alone", () => {
    expect(groupsSource).toContain('aria-label={`${formatDayLabel(day.dayOfWeek)}, ${formatDateLabel(day.date)}${day.isActive ? "" : ", день выключен"}`}');
    expect(groupsSource).toContain('"Выкл."');
  });

  it("takes platoons from the groups snapshot so groups-only users can edit rules", () => {
    expect(groupsSource).toContain("useState<Platoon[]>(initialSnapshot.platoons)");
    expect(groupsSource).toContain("setPlatoons(next.platoons)");
    expect(groupsSource).not.toContain('fetch("/api/platoons")');
  });
});
