import { cookies } from "next/headers";
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { query } from "./neon";

export const sessionCookieName = "envirosense_session";

export type AppRole = "ceo" | "admin" | "field_worker" | "lab_officer" | "public";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: AppRole;
  employeeCode: string | null;
  district: string | null;
  isActive: boolean;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
  employee_code: string | null;
  district: string | null;
  is_active: boolean;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, storedHash: string, salt: string) {
  const { hash } = hashPassword(password, salt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(storedHash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await query(
    `insert into app_sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + interval '14 days')`,
    [tokenHash, userId]
  );
  return token;
}

export async function deleteSession(token: string) {
  await query("delete from app_sessions where token_hash = $1", [hashToken(token)]);
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;

  const result = await query<UserRow>(
    `select u.id, u.email, u.password_hash, u.salt, u.full_name, u.phone, u.role, u.employee_code, u.district, u.is_active
     from app_sessions s
     join app_users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()
     limit 1`,
    [hashToken(token)]
  );

  const row = result.rows[0];
  return row ? toAppUser(row) : null;
}

export async function findUserByEmail(email: string) {
  const result = await query<UserRow>("select * from app_users where email = $1 limit 1", [normalizeEmail(email)]);
  return result.rows[0] ?? null;
}

export function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    employeeCode: row.employee_code,
    district: row.district,
    isActive: row.is_active
  };
}

export function setSessionCookie(response: Response, token: string) {
  response.headers.append(
    "Set-Cookie",
    `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`
  );
}

export function clearSessionCookie(response: Response) {
  response.headers.append(
    "Set-Cookie",
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
