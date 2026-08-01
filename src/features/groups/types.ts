
import type { Person, Platoon } from "../roster/types";

export type GroupTemplate = {
  id: string;
  key: string;
  name: string;
  colorToken: string;
  icon: string;
  defaultPeoplePerDay: number;
  defaultActiveDays: number[];
  sortOrder: number;
  isSystem: boolean;
  createdAt: number;
};

export type DutyGroup = {
  id: string;
  templateId: string;
  name: string;
  notes: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type GroupPriorityMode = "oldest" | "random";
export type GroupAssignmentQuota = { platoonId: string; count: number };
export type GroupOverlapPolicy = "exclusive" | "manual";

export type GroupRule = {
  id: string;
  groupId: string;
  enabledPlatoons: string[];
  peoplePerDay: number;
  assignmentQuotas: GroupAssignmentQuota[];
  autoRotate: boolean;
  activeDays: number[];
  priorityMode: GroupPriorityMode;
  overlapPolicy: GroupOverlapPolicy;
};

export type AssignmentSource = "auto" | "manual";
export type ConflictState = "clear" | "warning" | "allowed";
export type ConflictKind = "blocking" | "allowed";

export type GroupConflict = {
  groupId: string;
  groupName: string;
  date: string;
  kind: ConflictKind;
};

export type GroupAssignment = {
  id: string;
  groupId: string;
  personId: string;
  personName: string | null;
  personRank: string | null;
  personConscriptionNumber: string | null;
  assignedDate: string;
  source: AssignmentSource;
  conflictState: ConflictState;
  conflicts: GroupConflict[];
  createdAt: number;
};

export type GroupAssignmentRangeSkip = {
  date: string;
  reason: "inactive_day" | "excluded" | "platoon_disabled" | "group_disabled" | "overfilled" | "already_assigned" | "conflict";
  conflicts: GroupConflict[];
};

export type GroupAssignmentRangeResult = {
  snapshot: GroupsSnapshot;
  from: string;
  to: string;
  assignedDates: string[];
  skippedDates: GroupAssignmentRangeSkip[];
};

export type GroupExclusion = {
  id: string;
  groupId: string;
  personId: string;
  personName: string | null;
  personRank: string | null;
  personConscriptionNumber: string | null;
  dayOfWeek: number | null;
  reason: string;
  createdAt: number;
};

export type GroupDaySnapshot = {
  date: string;
  dayOfWeek: number;
  isActive: boolean;
  assignments: GroupAssignment[];
  candidatesCount: number;
  conflictsCount: number;
};

export type DutyGroupSnapshot = {
  group: DutyGroup;
  template: GroupTemplate;
  rule: GroupRule;
  todayAssignments: GroupAssignment[];
  week: GroupDaySnapshot[];
  exclusions: GroupExclusion[];
  availablePeople: Person[];
  availablePeopleByDate: Record<string, Person[]>;
  candidatePeople: Person[];
  candidatePlatoons: Platoon[];
  stats: {
    assignedToday: number;
    availableToday: number;
    conflictsToday: number;
    weekAssignments: number;
  };
};

export type GroupsSnapshot = {
  templates: GroupTemplate[];
  groups: DutyGroup[];
  platoons: Platoon[];
  groupSnapshots: Record<string, DutyGroupSnapshot>;
  weekDates: string[];
};

export type GroupCreateInput = {
  name: string;
  templateId: string;
  notes?: string;
};

export type GroupUpdateInput = {
  id: string;
  expectedUpdatedAt?: number;
  name?: string;
  templateId?: string;
  notes?: string;
  enabled?: boolean;
};

export type RuleUpdateInput = {
  groupId: string;
  expectedUpdatedAt?: number;
  enabledPlatoons?: string[];
  peoplePerDay?: number;
  assignmentQuotas?: GroupAssignmentQuota[];
  autoRotate?: boolean;
  activeDays?: number[];
  priorityMode?: GroupPriorityMode;
  overlapPolicy?: GroupOverlapPolicy;
  confirmOverlapCleanup?: boolean;
};
