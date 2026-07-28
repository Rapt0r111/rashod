
import type { GroupConflict, GroupCreateInput, GroupsSnapshot, GroupUpdateInput, RuleUpdateInput } from "./types";

export class GroupApiError extends Error {
  status: number;
  conflicts: GroupConflict[];

  constructor(message: string, status: number, conflicts: GroupConflict[] = []) {
    super(message);
    this.name = "GroupApiError";
    this.status = status;
    this.conflicts = conflicts;
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
    const payload = await response.json().catch(() => ({}));
    throw new GroupApiError(payload.error ?? `HTTP_${response.status}`, response.status, payload.conflicts ?? []);
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
