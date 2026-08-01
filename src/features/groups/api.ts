import { ApiError, fetchJson, getApiErrorMessage as getBaseApiErrorMessage } from "@/lib/api-client";
import type {
  GroupConflict,
  GroupAssignmentRangeResult,
  GroupCreateInput,
  GroupsSnapshot,
  GroupUpdateInput,
  RuleUpdateInput,
} from "./types";

export class GroupApiError extends Error {
  status: number;
  conflicts: GroupConflict[];
  code: string;
  reason?: string;
  cleanupCount: number;

  constructor(
    message: string,
    status: number,
    conflicts: GroupConflict[] = [],
    reason?: string,
    cleanupCount = 0,
  ) {
    super(message);
    this.name = "GroupApiError";
    this.status = status;
    this.conflicts = conflicts;
    this.code = message;
    this.reason = reason;
    this.cleanupCount = cleanupCount;
  }
}

function toGroupApiError(error: unknown): never {
  if (error instanceof GroupApiError) throw error;
  if (error instanceof ApiError) {
    const payload = error.payload;
    const conflicts =
      payload &&
      typeof payload === "object" &&
      "conflicts" in payload &&
      Array.isArray((payload as { conflicts: unknown }).conflicts)
        ? ((payload as { conflicts: GroupConflict[] }).conflicts)
        : [];
    const reason =
      payload &&
      typeof payload === "object" &&
      "reason" in payload &&
      typeof (payload as { reason: unknown }).reason === "string"
        ? (payload as { reason: string }).reason
        : undefined;
    const cleanupCount =
      payload && typeof payload === "object" && "cleanupCount" in payload &&
      typeof (payload as { cleanupCount: unknown }).cleanupCount === "number"
        ? (payload as { cleanupCount: number }).cleanupCount
        : 0;
    throw new GroupApiError(error.code, error.status, conflicts, reason, cleanupCount);
  }
  throw error;
}

export function getGroupErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof GroupApiError)) {
    return getBaseApiErrorMessage(error, fallback);
  }

  if (error.code === "GROUP_ASSIGNMENT_INELIGIBLE") {
    switch (error.reason) {
      case "group_disabled":
        return "Группа отключена. Включите её в настройках и повторите попытку.";
      case "inactive_day":
        return "Группа не работает в выбранный день. Выберите другую дату или включите этот день в правилах.";
      case "platoon_disabled":
        return "Подразделение человека не входит в правила группы.";
      case "excluded":
        return "Человек исключён из этой группы на выбранный день.";
      default:
        return "Человек не подходит для этой группы на выбранную дату.";
    }
  }

  if (error.code === "GROUP_ASSIGNMENT_OVERFILLED") {
    return "На выбранную дату уже назначено нужное количество людей.";
  }

  if (error.code === "GROUP_OVERLAP_CLEANUP_REQUIRED") {
    return `Для строгого режима нужно удалить ${error.cleanupCount} конфликтующих назначений. Подтвердите операцию.`;
  }

  if (error.code === "GROUP_ASSIGNMENT_CONFLICT") {
    return "Назначение заблокировано: человек уже назначен в другую строгую группу на эту дату.";
  }

  return getBaseApiErrorMessage(
    new ApiError(error.code, error.status, null),
    fallback,
  );
}

export async function fetchGroupJson<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    return await fetchJson<T>(url, init);
  } catch (error) {
    toGroupApiError(error);
  }
}

export function fetchGroupsSnapshot(): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups");
}

export function createGroup(input: GroupCreateInput): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGroup(input: GroupUpdateInput): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteGroup(id: string): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}

export function updateRule(input: RuleUpdateInput): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/rule", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function rotateGroup(groupId: string, date?: string): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/rotate", {
    method: "POST",
    body: JSON.stringify({ groupId, date }),
  });
}

export function assignGroupPerson(
  groupId: string,
  personId: string,
  date?: string,
): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/assign", {
    method: "POST",
    body: JSON.stringify({ groupId, personId, date }),
  });
}

export function assignGroupPersonRange(
  groupId: string,
  personId: string,
  from: string,
  to: string,
): Promise<GroupAssignmentRangeResult> {
  return fetchGroupJson<GroupAssignmentRangeResult>("/api/groups/assign", {
    method: "POST",
    body: JSON.stringify({ groupId, personId, from, to }),
  });
}

export function removeGroupAssignment(assignmentId: string): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/assign", {
    method: "DELETE",
    body: JSON.stringify({ assignmentId }),
  });
}

export function excludeGroupPerson(
  groupId: string,
  personId: string,
  dayOfWeek: number | null,
  reason = "",
): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/exclude", {
    method: "POST",
    body: JSON.stringify({ groupId, personId, dayOfWeek, reason }),
  });
}

export function includeGroupPerson(exclusionId: string): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/exclude", {
    method: "DELETE",
    body: JSON.stringify({ exclusionId }),
  });
}
