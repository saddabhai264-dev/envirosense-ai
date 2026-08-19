import { NextResponse } from "next/server";
import { ensureNeonSchema, query } from "@/lib/neon";
import { createSession, hashPassword, normalizeEmail, setSessionCookie, toAppUser } from "@/lib/server-auth";

type SignupBody = {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  full_name: string;
  phone: string | null;
  role: "public";
  employee_code: null;
  district: null;
  is_active: boolean;
};

export async function POST(request: Request) {
  await ensureNeonSchema();
  const body = (await request.json()) as SignupBody;
  const email = normalizeEmail(body.email || "");
  const password = body.password || "";
  const fullName = body.fullName?.trim() || "";
  const phone = body.phone?.trim() || null;

  if (!email || !password || !fullName) {
    return NextResponse.json({ ok: false, message: "Name, email, and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ ok: false, message: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { salt, hash } = hashPassword(password);

  try {
    const result = await query<UserRow>(
      `insert into app_users (email, password_hash, salt, full_name, phone, role)
       values ($1, $2, $3, $4, $5, 'public')
       returning id, email, password_hash, salt, full_name, phone, role, employee_code, district, is_active`,
      [email, hash, salt, fullName, phone]
    );
    const user = result.rows[0];
    const token = await createSession(user.id);
    const response = NextResponse.json({ ok: true, user: toAppUser(user) });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error && error.message.includes("duplicate")
      ? "Account already exists. Use sign in."
      : "Could not create account.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
