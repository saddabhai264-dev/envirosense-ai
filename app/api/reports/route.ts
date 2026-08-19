import { NextResponse } from "next/server";
import { ensureNeonSchema, query } from "@/lib/neon";
import { getCurrentUser } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { publicReportInsertPayload } from "@/lib/supabase-mappers";
import type { PublicReport } from "@/lib/types";

type ReportBody = {
  reporterName: string;
  phone: string;
  city: string;
  location: string;
  latitude: string;
  longitude: string;
  type: string;
  severity: PublicReport["severity"];
  description: string;
  affectedFamilies: string;
  mediaUrl?: string | null;
};

export async function GET() {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  }

  const staffRoles = ["ceo", "admin", "field_worker"];
  if (!staffRoles.includes(user.role) && user.role !== "public") {
    return NextResponse.json({ ok: false, message: "Reports are available to response staff only." }, { status: 403 });
  }

  let result;
  if (["ceo", "admin"].includes(user.role)) {
    result = await query("select * from public_reports order by created_at desc limit 100");
  } else if (user.role === "field_worker") {
    result = user.district
      ? await query("select * from public_reports where city = $1 order by created_at desc limit 100", [user.district])
      : await query("select * from public_reports where false");
  } else {
    result = await query("select * from public_reports where reporter_id = $1 order by created_at desc limit 100", [user.id]);
  }

  return NextResponse.json({ ok: true, data: result.rows });
}

export async function POST(request: Request) {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json()) as ReportBody;
  const payload = publicReportInsertPayload({ ...body, reporterId: user.id });

  const result = await query(
    `insert into public_reports (
      reporter_id, reporter_name, phone, city, location_text, latitude, longitude,
      report_type, severity, description, affected_families, media_url, status
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    returning *`,
    [
      payload.reporter_id,
      payload.reporter_name,
      payload.phone,
      payload.city,
      payload.location_text,
      payload.latitude,
      payload.longitude,
      payload.report_type,
      payload.severity,
      payload.description,
      payload.affected_families,
      payload.media_url,
      payload.status
    ]
  );

  await writeAuditLog({
    actorId: user.id,
    action: "public_report_submitted",
    entityType: "public_report",
    entityId: result.rows[0].id,
    message: `${user.fullName} submitted ${payload.severity} ${payload.report_type} report for ${payload.city}.`,
    metadata: { city: payload.city, severity: payload.severity, reportType: payload.report_type }
  });

  return NextResponse.json({ ok: true, data: result.rows[0] });
}
