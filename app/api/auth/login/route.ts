import { NextResponse } from "next/server";
import { ensureNeonSchema } from "@/lib/neon";
import {
  createSession,
  findUserByEmail,
  setSessionCookie,
  toAppUser,
  verifyPassword
} from "@/lib/server-auth";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  await ensureNeonSchema();
  const body = (await request.json()) as LoginBody;
  const email = body.email?.trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, message: "Email and password are required." }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    return NextResponse.json({ ok: false, message: "Invalid email or password." }, { status: 401 });
  }

  if (!user.is_active) {
    return NextResponse.json({ ok: false, message: "This account is inactive. Contact the CEO or admin." }, { status: 403 });
  }

  const token = await createSession(user.id);
  const response = NextResponse.json({ ok: true, user: toAppUser(user) });
  setSessionCookie(response, token);
  return response;
}
