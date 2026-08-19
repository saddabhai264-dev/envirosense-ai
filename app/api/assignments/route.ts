import { NextResponse } from "next/server";
import { ensureNeonSchema, query } from "@/lib/neon";
import { getCurrentUser } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { sendAssignmentEmail } from "@/lib/email";

type AssignmentBody = {
  reportId?: string;
  assignedTo?: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  dueAt?: string;
  notes?: string;
  status?: "Assigned" | "In progress" | "Completed" | "Blocked";
};

const priorities = ["Low", "Medium", "High", "Critical"];
const statuses = ["Assigned", "In progress", "Completed", "Blocked"];

export async function GET() {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin", "field_worker"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "Response staff access required." }, { status: 403 });
  }

  const result = ["ceo", "admin"].includes(user.role)
    ? await query(assignmentSelectSql("order by a.created_at desc limit 100"))
    : await query(assignmentSelectSql("where a.assigned_to = $1 order by a.created_at desc limit 100"), [user.id]);

  return NextResponse.json({ ok: true, data: result.rows });
}

export async function POST(request: Request) {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "CEO or admin access required." }, { status: 403 });
  }

  const body = (await request.json()) as AssignmentBody;
  const priority = body.priority || "High";
  const notes = body.notes?.trim() || null;
  const dueAt = body.dueAt?.trim() || null;

  if (!body.reportId || !body.assignedTo) {
    return NextResponse.json({ ok: false, message: "Report and employee are required." }, { status: 400 });
  }

  if (!priorities.includes(priority)) {
    return NextResponse.json({ ok: false, message: "Valid priority is required." }, { status: 400 });
  }

  const assignee = await query<{ id: string; full_name: string; email: string }>(
    "select id, full_name, email from app_users where id = $1 and role = 'field_worker' and is_active = true limit 1",
    [body.assignedTo]
  );
  const assigneeRow = assignee.rows[0];
  if (!assigneeRow) {
    return NextResponse.json({ ok: false, message: "Choose an active field worker." }, { status: 400 });
  }

  const result = await query(
    `insert into report_assignments (report_id, assigned_to, assigned_by, priority, due_at, notes)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [body.reportId, body.assignedTo, user.id, priority, dueAt, notes]
  );

  await query("update public_reports set status = 'In progress' where id = $1 and status <> 'Resolved'", [body.reportId]);

  const assignment = await query(assignmentSelectSql("where a.id = $1 limit 1"), [result.rows[0].id]);
  const assignmentRow = assignment.rows[0];
  const email = await sendAssignmentEmail({
    to: assigneeRow.email,
    assigneeName: assigneeRow.full_name,
    assignedByName: user.fullName,
    city: assignmentRow.city,
    reportType: assignmentRow.report_type,
    severity: assignmentRow.severity,
    priority: assignmentRow.priority,
    dueAt: assignmentRow.due_at,
    notes: assignmentRow.notes
  });

  await writeAuditLog({
    actorId: user.id,
    action: "assignment_created",
    entityType: "report_assignment",
    entityId: assignmentRow.id,
    message: `${user.fullName} assigned ${assignmentRow.city} ${assignmentRow.report_type} report to ${assigneeRow.full_name}.`,
    metadata: {
      reportId: body.reportId,
      assignedTo: body.assignedTo,
      priority,
      emailStatus: email.status
    }
  });

  return NextResponse.json({ ok: true, data: assignmentRow, notification: email });
}

export async function PATCH(request: Request) {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin", "field_worker"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "Response staff access required." }, { status: 403 });
  }

  const body = (await request.json()) as AssignmentBody & { id?: string };
  if (!body.id || !body.status || !statuses.includes(body.status)) {
    return NextResponse.json({ ok: false, message: "Assignment id and valid status are required." }, { status: 400 });
  }

  const result = ["ceo", "admin"].includes(user.role)
    ? await query(
        "update report_assignments set status = $1, updated_at = now() where id = $2 returning id",
        [body.status, body.id]
      )
    : await query(
        "update report_assignments set status = $1, updated_at = now() where id = $2 and assigned_to = $3 returning id",
        [body.status, body.id, user.id]
      );

  if (!result.rows[0]) {
    return NextResponse.json({ ok: false, message: "Assignment not found or not allowed." }, { status: 404 });
  }

  if (body.status === "Completed") {
    await query(
      `update public_reports
       set status = 'Resolved'
       where id = (select report_id from report_assignments where id = $1)`,
      [result.rows[0].id]
    );
  }

  const assignment = await query(assignmentSelectSql("where a.id = $1 limit 1"), [result.rows[0].id]);
  const assignmentRow = assignment.rows[0];
  await writeAuditLog({
    actorId: user.id,
    action: "assignment_status_updated",
    entityType: "report_assignment",
    entityId: assignmentRow.id,
    message: `${user.fullName} marked ${assignmentRow.city} assignment as ${body.status}.`,
    metadata: {
      reportId: assignmentRow.report_id,
      status: body.status
    }
  });

  return NextResponse.json({ ok: true, data: assignmentRow });
}

function assignmentSelectSql(tail: string) {
  return `
    select
      a.id,
      a.report_id,
      a.assigned_to,
      a.assigned_by,
      a.priority,
      a.due_at,
      a.notes,
      a.status,
      a.created_at,
      a.updated_at,
      r.city,
      r.report_type,
      r.severity,
      r.location_text,
      assignee.full_name as assigned_to_name,
      assignee.email as assigned_to_email,
      creator.full_name as assigned_by_name
    from report_assignments a
    join public_reports r on r.id = a.report_id
    left join app_users assignee on assignee.id = a.assigned_to
    left join app_users creator on creator.id = a.assigned_by
    ${tail}
  `;
}
