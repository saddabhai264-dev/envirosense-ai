import { NextResponse } from "next/server";
import { ensureNeonSchema, query } from "@/lib/neon";
import { getCurrentUser } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit-log";
import type { PublicReport } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

type StatusBody = {
  status?: PublicReport["status"];
};

const allowedStatuses: PublicReport["status"][] = ["New", "Verified", "In progress", "Resolved", "False/duplicate"];

export async function PATCH(request: Request, { params }: Params) {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin", "field_worker"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "Response staff access required." }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as StatusBody;
  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ ok: false, message: "Valid status is required." }, { status: 400 });
  }

  const result = await query("update public_reports set status = $1 where id = $2 returning *", [body.status, id]);
  if (!result.rows[0]) {
    return NextResponse.json({ ok: false, message: "Report not found." }, { status: 404 });
  }

  await writeAuditLog({
    actorId: user.id,
    action: "report_status_updated",
    entityType: "public_report",
    entityId: id,
    message: `${user.fullName} changed ${result.rows[0].city} report status to ${body.status}.`,
    metadata: { status: body.status, reportType: result.rows[0].report_type }
  });

  return NextResponse.json({ ok: true, data: result.rows[0] });
}
