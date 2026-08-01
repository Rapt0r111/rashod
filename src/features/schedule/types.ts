import type { Person, Platoon } from "../roster/types";
import type { DutyGroup, GroupAssignment } from "../groups/types";

export type ScheduleSnapshot = {
  from: string;
  to: string;
  dates: string[];
  people: Person[];
  platoons: Platoon[];
  groups: DutyGroup[];
  assignments: GroupAssignment[];
};
