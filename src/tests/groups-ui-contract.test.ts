import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  scheduleCacheAfterGroupsEvent,
  shouldFetchScheduleOnEnter,
} from "@/features/WorkspaceApp";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const workspaceSource = read("src/features/WorkspaceApp.tsx");
const groupsSource = read("src/features/groups/GroupsApp.tsx");
const groupsToolbarSource = read("src/features/groups/components/group-toolbar.tsx");
const groupsWeekSource = read("src/features/groups/components/week-strip.tsx");
const groupsSettingsSource = read("src/features/groups/components/settings-panel.tsx");
const groupsCreateSource = read("src/features/groups/components/create-group-panel.tsx");
const groupsPickerSource = read("src/features/groups/components/person-picker-panel.tsx");
const groupsExclusionsSource = read("src/features/groups/components/exclusions-panel.tsx");
const groupsDrawerSource = read("src/features/groups/components/drawer.tsx");
const groupsConstantsSource = read("src/features/groups/components/constants.ts");
const groupsUiSource = [
  groupsSource,
  groupsToolbarSource,
  groupsWeekSource,
  groupsSettingsSource,
  groupsCreateSource,
  groupsPickerSource,
  groupsExclusionsSource,
  groupsDrawerSource,
  groupsConstantsSource,
].join("\n");
const groupsApiSource = read("src/features/groups/api.ts");
const searchSource = read("src/components/search-sort-control.tsx");

describe("Groups responsive UI contract", () => {
  it("refetches the groups-only schedule on every enter and drops it on SSE when hidden", () => {
    expect(shouldFetchScheduleOnEnter()).toBe(true);
    expect(scheduleCacheAfterGroupsEvent("schedule")).toBe("reload");
    expect(scheduleCacheAfterGroupsEvent("groups")).toBe("drop");
    expect(workspaceSource).not.toContain("if (scheduleSnapshot || loadingSchedule) return");
    expect(workspaceSource).toContain("useRealtimeDomain([\"groups\", \"unknown\"]");
  });

  it("gives the standalone groups route its own scroll container", () => {
    expect(workspaceSource).toContain(
      'className="h-dvh min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-bg-base"',
    );
  });

  it("uses mobile-first breakpoints for the groups workspace", () => {
    expect(groupsSource).toContain("lg:grid-cols-[minmax(210px,250px)_minmax(0,1fr)]");
    expect(groupsSource).toContain("xl:grid-cols-[minmax(210px,250px)_minmax(0,1fr)_minmax(260px,310px)]");
    expect(groupsWeekSource).toContain("sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7");
    expect(groupsUiSource).not.toContain("max-[860px]:grid-cols-1");
    expect(groupsUiSource).not.toContain("max-[520px]:grid-cols-1");
  });

  it("lets the shared search control shrink inside narrow panels", () => {
    expect(searchSource).toContain("min-w-0 flex-1 basis-full");
    expect(searchSource).toContain("w-full min-w-0 shrink-0");
    expect(searchSource).not.toContain("min-w-45 flex-1 basis-65");
  });

  it("contains the group toolbar title and keeps actions in an adaptive grid", () => {
    expect(groupsToolbarSource).toContain(
      "min-[1800px]:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(groupsToolbarSource).toContain(
      "grid-cols-[repeat(auto-fit,minmax(140px,1fr))]",
    );
    expect(groupsToolbarSource).toContain("min-w-0");
    expect(groupsToolbarSource).not.toContain("min-[1100px]:grid-cols");
  });

  it("handles mutation API errors inside the click callback", () => {
    const mutationSource = groupsSource.slice(
      groupsSource.indexOf("async function run("),
      groupsSource.indexOf("async function assignPerson("),
    );

    expect(mutationSource).toContain("catch (error) {");
    expect(groupsSource).toContain("getGroupErrorMessage(err, \"Назначение не выполнено\")");
    expect(mutationSource).toContain("if (rethrowErrors) throw error;");
  });

  it("offers an explicit recovery after a failed Groups action", () => {
    expect(groupsSource).toContain('role="alert"');
    expect(groupsSource).toContain("Обновить данные");
    expect(groupsSource).toContain("void refresh(true)");
  });

  it("makes mutation results and destructive actions explicit", () => {
    expect(groupsSource).toContain("setNotice(successMessage)");
    expect(groupsSource).toContain('role="status"');
    expect(groupsSettingsSource).toContain("Удалить группу?");
    expect(groupsSettingsSource).toContain("без возможности отмены");
    expect(groupsPickerSource).not.toContain("Назначить с конфликтом");
    expect(groupsSettingsSource).toContain("Разрешать ручное совмещение");
    expect(groupsUiSource).not.toContain("window.confirm");
  });

  it("guards duplicate mutations and ignores stale refresh snapshots", () => {
    expect(groupsSource).toContain("const isMutatingRef = useRef(false);");
    expect(groupsSource).toContain("if (!canWrite || isMutatingRef.current) return null;");
    expect(groupsSource).toContain("const snapshotRevisionRef = useRef(0);");
    expect(groupsSource).toContain("if (revision === snapshotRevisionRef.current)");
    expect(groupsSource).toContain("getGroupErrorMessage(err,");
    expect(groupsSource).toContain("expectedUpdatedAt: activeSnapshot.group.updatedAt");
  });

  it("keeps explicit Groups copy under regression", () => {
    const phrase = (...codes: number[]) => String.fromCodePoint(...codes);
    expect(groupsToolbarSource).toContain(phrase(0x417, 0x430, 0x43f, 0x443, 0x441, 0x442, 0x438, 0x442, 0x44c, 0x20, 0x440, 0x43e, 0x442, 0x430, 0x446, 0x438, 0x44e));
  });

  it("does not ship replacement characters or literal unicode escapes", () => {
    for (const source of [groupsUiSource, groupsApiSource]) {
      expect(source).not.toContain("\uFFFD");
      expect(source).not.toContain("\\u");
    }
  });

  it("keeps no-template and no-candidate states actionable", () => {
    expect(groupsCreateSource).toContain("Нет шаблонов для группы");
    expect(groupsPickerSource).toContain("Нет кандидатов на выбранный период");
    expect(groupsPickerSource).toContain("Проверьте исключения и правила группы или выберите другой период.");
  });

  it("supports one-date and range assignment from the Groups picker", () => {
    expect(groupsSource).toContain("assignGroupPersonRange");
    expect(groupsSource).toContain("from = effectiveSelectedDate");
    expect(groupsPickerSource).toContain("schedulePresetRange");
    expect(groupsPickerSource).toContain('["month", "Месяц"]');
    expect(groupsPickerSource).toContain('type="date"');
    expect(groupsPickerSource).toContain("fetchGroupCandidates");
    expect(groupsPickerSource).toContain("peopleAvailableOnAnyDate");
    expect(groupsPickerSource).not.toContain("dates.length === 1 ? people : candidatePeople");
  });

  it("bounds editable group text and preserves dialog semantics", () => {
    expect(groupsSettingsSource).toContain("maxLength={GROUP_NAME_MAX_LENGTH}");
    expect(groupsSettingsSource).toContain("maxLength={GROUP_NOTES_MAX_LENGTH}");
    expect(groupsExclusionsSource).toContain("maxLength={EXCLUSION_REASON_MAX_LENGTH}");
    expect(groupsDrawerSource).toContain("aria-labelledby={titleId}");
    expect(groupsDrawerSource).toContain('document.body.style.overflow = "hidden"');
    expect(groupsExclusionsSource).toContain('placeholder="Выберите человека"');
    expect(groupsUiSource).not.toContain("peopleOptions[0]?.value");
  });

  it("keeps invalid dates from reaching manual assignment or rotation", () => {
    expect(groupsSource).toContain("const effectiveSelectedDate = selectedDay?.date ?? selectedDate;");
    expect(groupsSource).toContain("selectedAvailablePeople =");
    expect(groupsSource).toContain("availablePeopleByDate[effectiveSelectedDate]");
    expect(groupsSource).toContain("rotateGroup(activeSnapshot.group.id, effectiveSelectedDate)");
    expect(groupsSource).toContain("effectiveSelectedDate");
    expect(groupsSource).not.toContain("allowConflict");
  });

  it("labels inactive week days without relying on opacity alone", () => {
    expect(groupsWeekSource).toContain('aria-label={`${formatDayLabel(day.dayOfWeek)}, ${formatDateLabel(day.date)}${day.isActive ? "" : ", день выключен"}`}');
    expect(groupsWeekSource).toContain('"Выкл."');
  });

  it("takes platoons from the groups snapshot so groups-only users can edit rules", () => {
    expect(groupsSource).toContain("useState<Platoon[]>(initialSnapshot.platoons)");
    expect(groupsSource).toContain("setPlatoons(next.platoons)");
    expect(groupsSource).not.toContain('fetch("/api/platoons")');
  });

  it("syncs settings from the active group without a remount key", () => {
    expect(groupsSource).not.toContain("key={activeSnapshot.group.id}");
    expect(groupsSettingsSource).toContain("settingsSavedRevision");
    expect(groupsSettingsSource).toContain("}, [savedRevision]);")
    expect(groupsExclusionsSource).toContain("exclusion.dayOfWeek === selectedDay");
  });
});
