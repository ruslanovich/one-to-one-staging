import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { AuthError } from "./errors";

export type SessionUser = {
  userId: string;
  orgId: string;
  role: string;
};

const SESSION_COOKIE = "session_token";
const SESSION_TTL_DAYS = 7;

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export async function createSession(
  pool: Pool,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `insert into sessions (user_id, token, expires_at)
     values ($1, $2, $3)`,
    [userId, token, expiresAt],
  );

  return { token, expiresAt };
}

export async function getSessionByToken(
  pool: Pool,
  token: string,
): Promise<SessionUser | null> {
  const result = await pool.query<{
    user_id: string;
    org_id: string;
    role: string;
    expires_at: Date;
  }>(
    `select s.user_id, s.expires_at, p.org_id, p.role
     from sessions s
     join profiles p on p.user_id = s.user_id
     where s.token = $1
     limit 1`,
    [token],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await pool.query(`delete from sessions where token = $1`, [token]);
    return null;
  }

  await pool.query(
    `update sessions set last_used_at = now() where token = $1`,
    [token],
  );

  return {
    userId: row.user_id,
    orgId: row.org_id,
    role: row.role,
  };
}

export async function deleteSession(pool: Pool, token: string): Promise<void> {
  await pool.query(`delete from sessions where token = $1`, [token]);
}

export async function requireSession(
  request: Request,
  pool: Pool,
): Promise<SessionUser> {
  const token = getTokenFromRequest(request);
  if (!token) {
    throw new AuthError("missing session", 401);
  }

  const session = await getSessionByToken(pool, token);
  if (!session) {
    throw new AuthError("invalid session", 401);
  }

  return session;
}

export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) {
    return null;
  }
  return cookie.split("=").slice(1).join("=");
}
