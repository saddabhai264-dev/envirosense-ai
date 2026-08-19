import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie, deleteSession, sessionCookieName } from "@/lib/server-auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) {
    await deleteSession(token);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
