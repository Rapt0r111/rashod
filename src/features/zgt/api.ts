import type {
  EquipmentDetail,
  EquipmentFormValues,
  EquipmentListResult,
  EquipmentRecord,
  PersonPickerItem,
} from "./types";

async function parseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  return payload?.message || payload?.error || `HTTP_${response.status}`;
}

export async function fetchEquipmentList(params: {
  q?: string;
  status?: string;
  category?: string;
  location?: string;
  page?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<EquipmentListResult> {
  const url = new URL("/api/zgt/equipment", window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.pathname + url.search, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<EquipmentListResult>;
}

export async function fetchEquipmentDetail(id: string): Promise<EquipmentDetail> {
  const response = await fetch(`/api/zgt/equipment/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as { item: EquipmentDetail };
  return payload.item;
}

export async function searchZgtPeople(q: string): Promise<PersonPickerItem[]> {
  const url = new URL("/api/zgt/people/search", window.location.origin);
  url.searchParams.set("q", q);
  const response = await fetch(url.pathname + url.search, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as { items: PersonPickerItem[] };
  return payload.items;
}

async function postEquipmentAction(body: unknown) {
  const response = await fetch("/api/zgt/equipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function createEquipmentItem(data: EquipmentFormValues) {
  const payload = (await postEquipmentAction({ action: "create", data })) as {
    item: EquipmentRecord;
  };
  return payload.item;
}

export async function updateEquipmentItem(id: string, data: EquipmentFormValues) {
  const payload = (await postEquipmentAction({ action: "update", id, data })) as {
    item: EquipmentRecord;
  };
  return payload.item;
}

export async function deleteEquipmentItem(id: string) {
  await postEquipmentAction({ action: "delete", id });
}

export async function batchIssue(data: {
  ids: string[];
  toPersonId?: string | null;
  toLocation?: string;
  documentRef?: string;
  notes?: string;
}) {
  return postEquipmentAction({ action: "batch-issue", data }) as Promise<{
    affected: number;
  }>;
}

export async function batchReturn(data: {
  ids: string[];
  documentRef?: string;
  notes?: string;
}) {
  return postEquipmentAction({ action: "batch-return", data }) as Promise<{
    affected: number;
  }>;
}

export async function batchMove(data: {
  ids: string[];
  toLocation: string;
  notes?: string;
}) {
  return postEquipmentAction({ action: "batch-move", data }) as Promise<{
    affected: number;
  }>;
}
