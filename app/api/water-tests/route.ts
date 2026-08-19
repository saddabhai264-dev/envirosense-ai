import { NextResponse } from "next/server";
import { ensureNeonSchema, query } from "@/lib/neon";
import { getCurrentUser } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { waterTestInsertPayload } from "@/lib/supabase-mappers";
import type { WaterTest } from "@/lib/types";

export async function GET() {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin", "lab_officer"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "Water quality staff access required." }, { status: 403 });
  }

  const result = await query("select * from water_tests order by created_at desc limit 100");
  return NextResponse.json({ ok: true, data: result.rows });
}

export async function POST(request: Request) {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin", "lab_officer"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "Water quality staff access required." }, { status: 403 });
  }

  const body = (await request.json()) as WaterTest;
  const payload = waterTestInsertPayload(body, user.id);
  const result = await query(
    `insert into water_tests (
      city, location_text, latitude, longitude, ph, tds, turbidity, residual_chlorine,
      e_coli_detected, arsenic, nitrate, temperature, result, recommendation, created_by
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    returning *`,
    [
      payload.city,
      payload.location_text,
      payload.latitude,
      payload.longitude,
      payload.ph,
      payload.tds,
      payload.turbidity,
      payload.residual_chlorine,
      payload.e_coli_detected,
      payload.arsenic,
      payload.nitrate,
      payload.temperature,
      payload.result,
      payload.recommendation,
      payload.created_by
    ]
  );

  await writeAuditLog({
    actorId: user.id,
    action: "water_test_created",
    entityType: "water_test",
    entityId: result.rows[0].id,
    message: `${user.fullName} added ${payload.result || "water"} test for ${payload.city}.`,
    metadata: { city: payload.city, result: payload.result, recommendation: payload.recommendation }
  });

  return NextResponse.json({ ok: true, data: result.rows[0] });
}
