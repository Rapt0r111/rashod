
import type { GroupConflict, GroupCreateInput, GroupsSnapshot, GroupUpdateInput, RuleUpdateInput } from "./types";

export class GroupApiError extends Error {
  status: number;
  conflicts: GroupConflict[];
  code: string;
  reason?: string;

  constructor(
    message: string,
    status: number,
    conflicts: GroupConflict[] = [],
    reason?: string,
  ) {
    super(message);
    this.name = "GroupApiError";
    this.status = status;
    this.conflicts = conflicts;
    this.code = message;
    this.reason = reason;
  }
}

export function getGroupErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof GroupApiError)) {
    return `${fallback}. Проверьте соединение и повторите попытку.`;
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

  switch (error.status) {
    case 401:
      return "Сессия истекла. Войдите снова.";
    case 400:
      return "Проверьте введённые данные и повторите попытку.";
    case 403:
      return "Недостаточно прав для этого действия.";
    case 404:
      return "Данные уже изменились или удалены. Обновите экран и повторите попытку.";
    case 409:
      return "Данные изменились в другой операции. Обновите экран и повторите попытку.";
    case 429:
      return "Слишком много запросов. Подождите немного и повторите попытку.";
    default:
      return error.status >= 500
        ? "Сервер временно недоступен. Повторите попытку позже."
        : `${fallback}. Повторите попытку.`;
  }
}

export async function fetchGroupJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") window.location.assign("/");
    const payload = await response.json().catch(() => null);
    const code =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `HTTP_${response.status}`;
    const conflicts =
      payload && typeof payload === "object" && "conflicts" in payload && Array.isArray(payload.conflicts)
        ? (payload.conflicts as GroupConflict[])
        : [];
    const reason =
      payload && typeof payload === "object" && "reason" in payload && typeof payload.reason === "string"
        ? payload.reason
        : undefined;
    throw new GroupApiError(code, response.status, conflicts, reason);
  }
  return response.json() as Promise<T>;
}

export function fetchGroupsSnapshot(): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups");
}

export function createGroup(input: GroupCreateInput): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups", { method: "POST", body: JSON.stringify(input) });
}

export function updateGroup(input: GroupUpdateInput): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups", { method: "PUT", body: JSON.stringify(input) });
}

export function deleteGroup(id: string): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups", { method: "DELETE", body: JSON.stringify({ id }) });
}

export function updateRule(input: RuleUpdateInput): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/rule", { method: "PUT", body: JSON.stringify(input) });
}

export function rotateGroup(groupId: string, date?: string): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/rotate", { method: "POST", body: JSON.stringify({ groupId, date }) });
}

export function assignGroupPerson(groupId: string, personId: string, date?: string, allowConflict = false): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/assign", {
    method: "POST",
    body: JSON.stringify({ groupId, personId, date, allowConflict }),
  });
}

export function removeGroupAssignment(assignmentId: string): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/assign", { method: "DELETE", body: JSON.stringify({ assignmentId }) });
}

export function excludeGroupPerson(groupId: string, personId: string, dayOfWeek: number | null, reason = ""): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/exclude", {
    method: "POST",
    body: JSON.stringify({ groupId, personId, dayOfWeek, reason }),
  });
}

export function includeGroupPerson(exclusionId: string): Promise<GroupsSnapshot> {
  return fetchGroupJson<GroupsSnapshot>("/api/groups/exclude", { method: "DELETE", body: JSON.stringify({ exclusionId }) });
}
