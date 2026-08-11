import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { NextResponse } from "next/server";
import { inPostgresTransaction, pg } from "@/server/db/postgres";
import {
  PERMISSIONS,
  hasPermission,
  type Permission,
} from "@/features/auth/permissions";
import {
  canGrantRole,
  canManageTargetAccount,
  isAdministrator,
  type GrantActor,
  type GrantRole,
} from "./policy";
import { isSecureSessionCookie } from "./session-cookie";
import type { AuthContext, RoleRecord, UserRecord } from "./types";

export { isSecureSessionCookie } from "./session-cookie";
export type { AuthContext, RoleRecord, UserRecord } from "./types";


const ADMIN_ROLE_ID = "role-administrator";
const SESSION_COOKIE = "rashod_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 8;
const FAKE_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=2,p=1$JJAAf02FgXSxa9QFK9bSmdi92BtS3H0dRCufs+VoYI4$kwzgfY2DeuKwlSCqPImoCAgxYBCsHesz9PawpMASte0";
let initPromise: Promise<void> | null = null;

type SqlRole = GrantRole & { key: string; name: string; description: string };
type SqlUser = {
  id: string;
  username: string;
  display_name: string;
  session_version: number;
  role_ids: string[];
};
type Transaction = postgres.TransactionSql;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function cookieValue(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
function actor(context: AuthContext): GrantActor {
  return {
    id: context.user.id,
    roleIds: context.roleIds,
    permissions: context.permissions,
  };
}
function isValidForwardedAddress(value: string | null | undefined) {
  if (!value) return false;
  if (value.length > 64 || /[\r\n]/.test(value)) return false;
  return /^[a-f0-9:.]{3,64}$/i.test(value);
}
function clientAddressForRateLimit(request: Request) {
  if (process.env.AUTH_TRUST_PROXY !== "true") return "direct";
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (isValidForwardedAddress(forwarded)) return forwarded;
  if (isValidForwardedAddress(realIp)) return realIp;
  return "trusted-proxy-unknown";
}
function loginKey(username: string, request: Request) {
  const account = username.trim().toLocaleLowerCase("ru-RU").slice(0, 64);
  return createHash("sha256")
    .update(`${clientAddressForRateLimit(request)}:${account}`)
    .digest("hex");
}

async function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const permissions: Array<[Permission, string, string]> = [
      ["roster:read", "Просмотр состава", "Просмотр личного состава и истории"],
      [
        "roster:write",
        "Изменение состава",
        "Смена местоположений и отмена действий",
      ],
      [
        "references:manage",
        "Справочники",
        "Управление людьми, взводами и местами",
      ],
      ["groups:read", "Просмотр групп", "Просмотр назначений и истории групп"],
      [
        "groups:write",
        "Управление группами",
        "Настройка, назначение и ротация",
      ],
      ["tasks:read", "Просмотр задач", "Просмотр активных задач и истории выполнения"],
      ["tasks:write", "Управление задачами", "Создание задач, подзадач и отметка выполнения"],
      [
        "zgt:read",
        "Просмотр ЗГТ",
        "Просмотр техники, выдач и связанных данных ЗГТ",
      ],
      [
        "zgt:write",
        "Управление ЗГТ",
        "Выдача, сдача, перемещение и редактирование техники ЗГТ",
      ],
      [
        "users:manage",
        "Пользователи",
        "Создание и изменение непривилегированных пользователей",
      ],
      ["roles:manage", "Роли", "Просмотр и настройка пользовательских ролей"],
      [
        "access:grant",
        "Выдача доступа",
        "Выдача ролей и прав в пределах собственных полномочий",
      ],
    ];
    await inPostgresTransaction(async (transaction) => {
      for (const [key, label, description] of permissions)
        await transaction`INSERT INTO permissions (key, label, description) VALUES (${key}, ${label}, ${description}) ON CONFLICT (key) DO NOTHING`;
      await transaction`INSERT INTO roles (id, key, name, description, is_system) VALUES (${ADMIN_ROLE_ID}, 'administrator', 'Администратор', 'Полный доступ', true) ON CONFLICT (id) DO NOTHING`;
      for (const permission of PERMISSIONS)
        await transaction`INSERT INTO role_permissions (role_id, permission_key) VALUES (${ADMIN_ROLE_ID}, ${permission}) ON CONFLICT DO NOTHING`;
      await transaction`DELETE FROM sessions WHERE expires_at <= now()`;
    });
  })().catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

async function rolesByIds(ids: readonly string[]): Promise<SqlRole[]> {
  if (!ids.length) return [];
  const sql = pg();
  return sql<
    SqlRole[]
  >`SELECT roles.id, roles.key, roles.name, roles.description, roles.is_system AS "isSystem", COALESCE(array_agg(role_permissions.permission_key) FILTER (WHERE role_permissions.permission_key IS NOT NULL), '{}') AS permissions FROM roles LEFT JOIN role_permissions ON role_permissions.role_id = roles.id WHERE roles.id = ANY(${sql.array([...ids])}) GROUP BY roles.id`;
}

function assertGrantable(context: AuthContext, roles: GrantRole[]) {
  if (!context.permissions.includes("access:grant"))
    throw new Error("ACCESS_GRANT_REQUIRED");
  if (roles.some((role) => !canGrantRole(actor(context), role)))
    throw new Error("ROLE_GRANT_FORBIDDEN");
}

export async function getAuthContextByToken(
  token: string | undefined,
): Promise<AuthContext | null> {
  if (!token) return null;
  await initialize();
  const sql = pg();
  const users = await sql<
    SqlUser[]
  >`SELECT users.id, users.username, users.display_name, users.session_version, COALESCE(array_agg(user_roles.role_id) FILTER (WHERE user_roles.role_id IS NOT NULL), '{}') AS role_ids FROM sessions INNER JOIN users ON users.id = sessions.user_id LEFT JOIN user_roles ON user_roles.user_id = users.id WHERE sessions.token_hash = ${hashToken(token)} AND sessions.expires_at > now() AND sessions.session_version = users.session_version AND users.active = true GROUP BY users.id`;
  const user = users[0];
  if (!user) return null;
  const rows = await sql<
    { key: Permission }[]
  >`SELECT DISTINCT role_permissions.permission_key AS key FROM user_roles INNER JOIN role_permissions ON role_permissions.role_id = user_roles.role_id WHERE user_roles.user_id = ${user.id}`;
  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
    },
    permissions: rows.map((row) => row.key),
    roleIds: user.role_ids,
  };
}

export function getAuthContext(request: Request) {
  return getAuthContextByToken(cookieValue(request, SESSION_COOKIE));
}

export function requireSameOrigin(request: Request): NextResponse | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024)
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || requestUrl.protocol.replace(":", "");
  const host = request.headers.get("host")?.trim();
  const hostOrigin = host ? `${protocol}://${host}` : null;
  const expected = requestUrl.origin;
  const configured = (process.env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!origin || ![expected, ...(hostOrigin ? [hostOrigin] : []), ...configured].includes(origin))
    return NextResponse.json({ error: "CSRF_REJECTED" }, { status: 403 });
  return null;
}

export async function requirePermission(
  request: Request,
  permission: Permission,
): Promise<AuthContext | NextResponse> {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  const context = await getAuthContext(request);
  if (!context)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!hasPermission(context, permission))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return context;
}

export async function requireAnyPermission(
  request: Request,
  permissions: readonly Permission[],
): Promise<AuthContext | NextResponse> {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  const context = await getAuthContext(request);
  if (!context)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!permissions.some((permission) => hasPermission(context, permission)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return context;
}

export async function checkLoginRateLimit(username: string, request: Request) {
  await initialize();
  const key = loginKey(username, request);
  return inPostgresTransaction(async (transaction) => {
    const rows = await transaction<
      {
        attempt_count: number;
        window_started_at: Date;
        blocked_until: Date | null;
      }[]
    >`SELECT attempt_count, window_started_at, blocked_until FROM login_rate_limits WHERE key = ${key} FOR UPDATE`;
    const row = rows[0];
    if (!row) {
      await transaction`INSERT INTO login_rate_limits (key, attempt_count, window_started_at) VALUES (${key}, 0, now())`;
      return true;
    }
    if (row.blocked_until && row.blocked_until.getTime() > Date.now())
      return false;
    if (Date.now() - row.window_started_at.getTime() > LOGIN_WINDOW_MS)
      await transaction`UPDATE login_rate_limits SET attempt_count = 0, window_started_at = now(), blocked_until = NULL WHERE key = ${key}`;
    return true;
  });
}

export async function recordLoginAttempt(
  username: string,
  request: Request,
  success: boolean,
) {
  await initialize();
  const key = loginKey(username, request);
  await inPostgresTransaction(async (transaction) => {
    if (success) {
      await transaction`DELETE FROM login_rate_limits WHERE key = ${key}`;
      return;
    }
    const rows = await transaction<
      { attempt_count: number; window_started_at: Date }[]
    >`SELECT attempt_count, window_started_at FROM login_rate_limits WHERE key = ${key} FOR UPDATE`;
    const row = rows[0];
    if (!row) {
      await transaction`INSERT INTO login_rate_limits (key, attempt_count, window_started_at) VALUES (${key}, 1, now())`;
      return;
    }
    const count =
      Date.now() - row.window_started_at.getTime() > LOGIN_WINDOW_MS
        ? 1
        : row.attempt_count + 1;
    await transaction`UPDATE login_rate_limits SET attempt_count = ${count}, window_started_at = CASE WHEN ${count} = 1 THEN now() ELSE window_started_at END, blocked_until = CASE WHEN ${count} >= ${LOGIN_ATTEMPT_LIMIT} THEN now() + interval '15 minutes' ELSE NULL END WHERE key = ${key}`;
  });
}

export async function clearLoginRateLimits() {
  await initialize();
  await pg()`DELETE FROM login_rate_limits`;
}

export async function authenticate(username: string, password: string) {
  await initialize();
  const normalized = username.trim().toLocaleLowerCase("ru-RU");
  const rows = await pg()<
    {
      id: string;
      username: string;
      display_name: string;
      password_hash: string;
    }[]
  >`SELECT id, username, display_name, password_hash FROM users WHERE username = ${normalized} AND active = true`;
  const user = rows[0];
  const verified = await Bun.password.verify(
    password,
    user?.password_hash ?? FAKE_PASSWORD_HASH,
  );
  if (!user || !verified) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
  };
}

export async function createSession(userId: string) {
  await initialize();
  const token = randomBytes(32).toString("base64url");
  const [user] = await pg()<
    { session_version: number }[]
  >`SELECT session_version FROM users WHERE id = ${userId} AND active = true`;
  if (!user) throw new Error("USER_NOT_FOUND");
  await pg()`INSERT INTO sessions (token_hash, user_id, session_version, expires_at) VALUES (${hashToken(token)}, ${userId}, ${user.session_version}, now() + interval '12 hours')`;
  return token;
}
export async function destroySession(token: string | undefined) {
  if (token) {
    await initialize();
    await pg()`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }
}

async function assignRoles(
  transaction: Transaction,
  userId: string,
  roleIds: string[],
) {
  const unique = [...new Set(roleIds)];
  const existing = unique.length
    ? await transaction<
        { id: string }[]
      >`SELECT id FROM roles WHERE id = ANY(${pg().array(unique)})`
    : [];
  if (existing.length !== unique.length) throw new Error("ROLE_NOT_FOUND");
  await transaction`DELETE FROM user_roles WHERE user_id = ${userId}`;
  for (const roleId of unique)
    await transaction`INSERT INTO user_roles (user_id, role_id) VALUES (${userId}, ${roleId})`;
}

export async function assertCanGrantRoles(
  context: AuthContext,
  roleIds: string[],
) {
  const roles = await rolesByIds(roleIds);
  if (roles.length !== [...new Set(roleIds)].length)
    throw new Error("ROLE_NOT_FOUND");
  assertGrantable(context, roles);
}

export async function assertCanManageUser(
  context: AuthContext,
  targetId: string,
  securitySensitiveChange: boolean,
) {
  const roles = await rolesByIds(
    (
      await pg()<
        { role_id: string }[]
      >`SELECT role_id FROM user_roles WHERE user_id = ${targetId}`
    ).map((row) => row.role_id),
  );
  if (
    !canManageTargetAccount(
      actor(context),
      targetId,
      roles,
      securitySensitiveChange,
    )
  )
    throw new Error("USER_MANAGEMENT_FORBIDDEN");
}

export async function createAdministrator(
  username: string,
  password: string,
  displayName = username,
) {
  const id = await createUser({
    username,
    password,
    displayName,
    roleIds: [ADMIN_ROLE_ID],
  });
  return { id, username: username.trim().toLocaleLowerCase("ru-RU") };
}
export async function createUser(input: {
  username: string;
  password: string;
  displayName: string;
  roleIds: string[];
}) {
  await initialize();
  const username = input.username.trim().toLocaleLowerCase("ru-RU");
  if (!/^[\p{L}\p{N}._-]{3,64}$/u.test(username))
    throw new Error("INVALID_USERNAME");
  if (input.password.length < 12 || input.password.length > 256)
    throw new Error("PASSWORD_INVALID");
  if (!input.displayName.trim() || input.displayName.length > 160)
    throw new Error("DISPLAY_NAME_INVALID");
  if (!input.roleIds.length) throw new Error("ROLE_REQUIRED");
  const id = randomUUID();
  const passwordHash = await Bun.password.hash(input.password, {
    algorithm: "argon2id",
  });
  try {
    await inPostgresTransaction(async (transaction) => {
      const roles = await transaction<
        { id: string }[]
      >`SELECT id FROM roles WHERE id = ANY(${pg().array([...new Set(input.roleIds)])})`;
      if (roles.length !== new Set(input.roleIds).size)
        throw new Error("ROLE_NOT_FOUND");
      await transaction`INSERT INTO users (id, username, password_hash, display_name) VALUES (${id}, ${username}, ${passwordHash}, ${input.displayName.trim()})`;
      await assignRoles(transaction, id, input.roleIds);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_NOT_FOUND")
      throw error;
    throw new Error("USERNAME_EXISTS");
  }
  // Defer import to avoid cycles; setup-gate cache must drop after first user.
  const { invalidateHasUsersCache } = await import("@/server/cache/stable-data");
  invalidateHasUsersCache();
  return id;
}
export async function updateUser(input: {
  id: string;
  displayName?: string;
  active?: boolean;
  password?: string;
  roleIds?: string[];
}) {
  await initialize();
  if (
    input.password !== undefined &&
    (input.password.length < 12 || input.password.length > 256)
  )
    throw new Error("PASSWORD_INVALID");
  if (
    input.displayName !== undefined &&
    (!input.displayName.trim() || input.displayName.length > 160)
  )
    throw new Error("DISPLAY_NAME_INVALID");
  await inPostgresTransaction(async (transaction) => {
    const users = await transaction<
      { active: boolean }[]
    >`SELECT active FROM users WHERE id = ${input.id} FOR UPDATE`;
    if (!users[0]) throw new Error("USER_NOT_FOUND");
    const currentRoles = await transaction<
      { role_id: string }[]
    >`SELECT role_id FROM user_roles WHERE user_id = ${input.id} FOR UPDATE`;
    const nextRoleIds =
      input.roleIds === undefined
        ? currentRoles.map((row) => row.role_id)
        : [...new Set(input.roleIds)];
    if (!nextRoleIds.length) throw new Error("ROLE_REQUIRED");
    const currentIsAdmin = currentRoles.some(
      (row) => row.role_id === ADMIN_ROLE_ID,
    );
    const nextIsAdmin = nextRoleIds.includes(ADMIN_ROLE_ID);
    const nextActive = input.active ?? users[0].active;
    if (currentIsAdmin && (!nextIsAdmin || !nextActive)) {
      const activeAdmins = await transaction<
        { id: string }[]
      >`SELECT users.id FROM users INNER JOIN user_roles ON user_roles.user_id = users.id WHERE users.active = true AND user_roles.role_id = ${ADMIN_ROLE_ID} FOR UPDATE`;
      if (activeAdmins.length <= 1) throw new Error("LAST_ADMIN_PROTECTED");
    }
    if (input.displayName !== undefined)
      await transaction`UPDATE users SET display_name = ${input.displayName.trim()}, updated_at = now() WHERE id = ${input.id}`;
    if (input.active !== undefined)
      await transaction`UPDATE users SET active = ${input.active}, updated_at = now() WHERE id = ${input.id}`;
    if (input.password !== undefined)
      await transaction`UPDATE users SET password_hash = ${await Bun.password.hash(input.password, { algorithm: "argon2id" })}, updated_at = now() WHERE id = ${input.id}`;
    if (input.roleIds !== undefined)
      await assignRoles(transaction, input.id, nextRoleIds);
    if (
      input.password !== undefined ||
      input.active !== undefined ||
      input.roleIds !== undefined
    )
      await transaction`UPDATE users SET session_version = session_version + 1, updated_at = now() WHERE id = ${input.id}`;
  });
}
export async function listUsers(): Promise<UserRecord[]> {
  await initialize();
  const sql = pg();
  const rows = await sql<
    {
      id: string;
      username: string;
      display_name: string;
      active: boolean;
      created_at: Date;
      role_ids: string[];
    }[]
  >`SELECT users.id, users.username, users.display_name, users.active, users.created_at, COALESCE(array_agg(user_roles.role_id) FILTER (WHERE user_roles.role_id IS NOT NULL), '{}') AS role_ids FROM users LEFT JOIN user_roles ON user_roles.user_id = users.id GROUP BY users.id ORDER BY users.username`;
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    active: row.active,
    createdAt: row.created_at.getTime(),
    roleIds: row.role_ids,
  }));
}
export async function listRoles(): Promise<RoleRecord[]> {
  await initialize();
  return (
    await rolesByIds(
      (
        await pg()<
          { id: string }[]
        >`SELECT id FROM roles ORDER BY is_system DESC, name`
      ).map((row) => row.id),
    )
  ).map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.permissions as Permission[],
  }));
}
export async function saveRole(
  context: AuthContext,
  input: {
    id?: string;
    key: string;
    name: string;
    description?: string;
    permissions: Permission[];
  },
) {
  await initialize();
  const key = input.key.trim().toLocaleLowerCase("en-US");
  const id = input.id ?? randomUUID();
  if (!/^[a-z][a-z0-9_-]{2,63}$/.test(key)) throw new Error("INVALID_ROLE_KEY");
  if (!input.name.trim() || input.name.length > 120)
    throw new Error("ROLE_NAME_REQUIRED");
  const existing = input.id ? (await rolesByIds([id]))[0] : undefined;
  if (existing?.isSystem || id === ADMIN_ROLE_ID)
    throw new Error("SYSTEM_ROLE_PROTECTED");
  assertGrantable(context, [
    { id, isSystem: false, permissions: [...new Set(input.permissions)] },
  ]);
  const sql = pg();
  const duplicate =
    await sql`SELECT id FROM roles WHERE key = ${key} AND id <> ${id}`;
  if (duplicate.length) throw new Error("ROLE_KEY_EXISTS");
  await inPostgresTransaction(async (transaction) => {
    await transaction`INSERT INTO roles (id, key, name, description) VALUES (${id}, ${key}, ${input.name.trim()}, ${input.description?.trim() ?? ""}) ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, name = EXCLUDED.name, description = EXCLUDED.description`;
    await transaction`DELETE FROM role_permissions WHERE role_id = ${id}`;
    for (const permission of [...new Set(input.permissions)])
      await transaction`INSERT INTO role_permissions (role_id, permission_key) VALUES (${id}, ${permission})`;
  });
  return id;
}
export async function recordAuditEvent(input: {
  action: string;
  actorUserId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  await initialize();
  await pg()`INSERT INTO auth_audit_events (id, action, actor_user_id, target_user_id, metadata) VALUES (${randomUUID()}, ${input.action}, ${input.actorUserId ?? null}, ${input.targetUserId ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb)`;
}
export async function hasUsers() {
  await initialize();
  return (await pg()`SELECT 1 FROM users LIMIT 1`).length > 0;
}
export function sessionCookie(token: string) {
  return {
      name: SESSION_COOKIE,
      value: token,
      options: {
        httpOnly: true,
        sameSite: "strict" as const,
        secure: isSecureSessionCookie(),
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    },
  };
}
export function sessionToken(request: Request) {
  return cookieValue(request, SESSION_COOKIE);
}
export { hasPermission, isAdministrator, PERMISSIONS };
export type { Permission };
