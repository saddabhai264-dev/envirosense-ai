import { NextResponse } from "next/server";
import { ensureNeonSchema, query } from "@/lib/neon";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "CEO or admin access required." }, { status: 403 });
  }

  const result = await query(`
    select
      l.id,
      l.action,
      l.entity_type,
      l.entity_id,
      l.message,
      l.metadata,
      l.created_at,
      u.full_name as actor_name,
      u.role as actor_role
    from audit_logs l
    left join app_users u on u.id = l.actor_id
    order by l.created_at desc
    limit 80
  `);

  return NextResponse.json({ ok: true, data: result.rows });
}
