import { NextResponse } from "next/server";
import { ensureNeonSchema, isNeonConfigured, query } from "@/lib/neon";
import { hashPassword, normalizeEmail } from "@/lib/server-auth";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "Setup endpoint is disabled in production." }, { status: 404 });
  }

  if (!isNeonConfigured) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is missing." }, { status: 500 });
  }

  await ensureNeonSchema();

  const ceoEmail = normalizeEmail(process.env.CEO_EMAIL || "saddabhai264@gmail.com");
  const ceoPassword = process.env.CEO_PASSWORD;
  if (!ceoPassword) {
    return NextResponse.json({ ok: false, message: "CEO_PASSWORD is missing." }, { status: 500 });
  }
  const { salt, hash } = hashPassword(ceoPassword);

  await query(
    `insert into app_users (email, password_hash, salt, full_name, phone, role)
     values ($1, $2, $3, $4, $5, 'ceo')
     on conflict (email)
     do update set password_hash = excluded.password_hash, salt = excluded.salt, role = 'ceo', full_name = excluded.full_name`,
    [ceoEmail, hash, salt, "Saddam Hussain", null]
  );

  return NextResponse.json({
    ok: true,
    message: "Neon schema is ready and CEO account is configured."
  });
}
