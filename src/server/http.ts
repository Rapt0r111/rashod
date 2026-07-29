import { NextResponse } from "next/server";
import z, { ZodError, type ZodType } from "zod";
import { recordAuditEvent, type AuthContext } from "@/server/auth";
import { inPostgresTransaction } from "@/server/db/postgres";

const DEFAULT_ARRAY_LIMIT = 64;
const DEFAULT_STRING_LIMIT = 240;
const DEFAULT_JSON_LIMIT = 64 * 1024;
const ERROR_STATUS: Readonly<Record<string, number>> = {
  ACCESS_GRANT_REQUIRED: 403,
  BAD_REQUEST: 400,
  CSRF_REJECTED: 403,
  DAY_OF_WEEK_INVALID: 400,
  DISPLAY_NAME_INVALID: 400,
  FORBIDDEN: 403,
  GROUP_ASSIGNMENT_CONFLICT: 409,
  GROUP_ASSIGNMENT_INELIGIBLE: 409,
  GROUP_ASSIGNMENT_OVERFILLED: 409,
  GROUP_STALE_WRITE: 409,
  GROUP_NOT_FOUND: 404,
  GROUP_TEMPLATE_REQUIRED: 400,
  INVALID_ROLE_KEY: 400,
  INVALID_USERNAME: 400,
  LAST_ADMIN_PROTECTED: 409,
  LOCATION_GROUP_MEMBERSHIP_CONFLICT: 409,
  LOCATION_IN_USE: 409,
  LOCATION_NOT_FOUND: 404,
  LOCATION_REQUIRED: 400,
  PARENT_TASK_NOT_FOUND: 404,
  PASSWORD_INVALID: 400,
  PAYLOAD_TOO_LARGE: 413,
  PEOPLE_PER_DAY_INVALID: 400,
  PERSON_NOT_FOUND: 404,
  PLATOON_IN_USE: 409,
  PLATOON_NOT_FOUND: 404,
  ROLE_GRANT_FORBIDDEN: 403,
  ROLE_KEY_EXISTS: 409,
  ROLE_NAME_REQUIRED: 400,
  ROLE_NOT_FOUND: 404,
  ROLE_REQUIRED: 400,
  SYSTEM_ROLE_PROTECTED: 409,
  TASK_NOT_EDITABLE: 409,
  TASK_NOT_FOUND: 404,
  TASK_TITLE_REQUIRED: 400,
  TEMPLATE_NOT_FOUND: 404,
  UNSUPPORTED_MEDIA_TYPE: 415,
  USER_MANAGEMENT_FORBIDDEN: 403,
  USER_NOT_FOUND: 404,
  USERNAME_EXISTS: 409,
};

export const boundedString = (min = 1, max = DEFAULT_STRING_LIMIT) =>
  z.string().trim().min(min).max(max);

export const optionalBoundedString = (max = DEFAULT_STRING_LIMIT) =>
  z.string().trim().max(max).optional();
export const shortText = (max = DEFAULT_STRING_LIMIT) => boundedString(1, max);
export const optionalText = (max = DEFAULT_STRING_LIMIT) =>
  optionalBoundedString(max);

export const idString = z.string().trim().min(1).max(120);
export const optionalIdString = idString.optional();
export const uuidString = z.string().uuid();
export const sortOrderNumber = z.number().int().min(0).max(9_999_999_999);
export const sortOrder = sortOrderNumber.optional();
export const dateKeyString = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}, "INVALID_DATE");
export const dateString = dateKeyString;
export const dayOfWeekNumber = z.number().int().min(0).max(6);

export function uniqueArray<T extends z.ZodTypeAny>(schema: T, max = DEFAULT_ARRAY_LIMIT) {
  return z
    .array(schema)
    .max(max)
    .refine((items) => new Set(items).size === items.length, "DUPLICATE_VALUES");
}

export function uniqueArrayBy<T extends z.ZodTypeAny>(
  schema: T,
  key: (item: z.infer<T>) => string | number,
  max = DEFAULT_ARRAY_LIMIT,
) {
  return z
    .array(schema)
    .max(max)
    .refine((items) => {
      const keys = items.map(key);
      return new Set(keys).size === keys.length;
    }, "DUPLICATE_VALUES");
}

export function uniqueStringArray(max = DEFAULT_ARRAY_LIMIT) {
  return uniqueArray(idString, max);
}

export function uniqueIntegerArray(max = 7) {
  return z
    .array(z.number().int())
    .max(max)
    .refine((items) => new Set(items).size === items.length, "DUPLICATE_VALUES");
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
  options: { maxBytes?: number } = {},
) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (!mediaType || (mediaType !== "application/json" && !mediaType.endsWith("+json"))) {
    throw new Error("UNSUPPORTED_MEDIA_TYPE");
  }

  const maxBytes = Math.max(0, Math.floor(options.maxBytes ?? DEFAULT_JSON_LIMIT));
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }

  if (!request.body) throw new Error("BAD_REQUEST");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return schema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof ZodError) throw error;
    throw new Error("BAD_REQUEST");
  }
}

export function apiError(
  error: unknown,
  options: { status?: number; extra?: Record<string, unknown> } = {},
) {
  if (error instanceof ZodError)
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const message = error instanceof Error ? error.message : "";
  const status = ERROR_STATUS[message];
  if (!status) {
    console.error("Unexpected API error", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  return NextResponse.json(
    { error: message, ...(options.extra ?? {}) },
    { status: options.status ?? status },
  );
}

export const apiErrorResponse = apiError;

export async function runAuditedMutation<T>(
  auth: AuthContext,
  action: string,
  mutate: () => Promise<T>,
  metadata?: Record<string, unknown> | ((result: T) => Record<string, unknown>),
  targetUserId?: string | ((result: T) => string | undefined),
) {
  return inPostgresTransaction(async () => {
    const result = await mutate();
    await recordAuditEvent({
      action,
      actorUserId: auth.user.id,
      targetUserId:
        typeof targetUserId === "function" ? targetUserId(result) : targetUserId,
      metadata: typeof metadata === "function" ? metadata(result) : (metadata ?? {}),
    });
    return result;
  });
}

export async function auditMutation(
  auth: AuthContext,
  action: string,
  metadata?: Record<string, unknown>,
) {
  await recordAuditEvent({
    action,
    actorUserId: auth.user.id,
    metadata: metadata ?? {},
  });
}
