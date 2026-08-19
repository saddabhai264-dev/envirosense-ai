import { NextResponse } from "next/server";
import { ensureNeonSchema, query } from "@/lib/neon";
import { getCurrentUser, hashPassword, normalizeEmail, toAppUser, type AppRole } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit-log";

type EmployeeBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: AppRole;
  password?: string;
  district?: string;
};

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
  district: string | null;
  is_active: boolean;
  created_at: string;
};

const staffRoles: AppRole[] = ["admin", "field_worker", "lab_officer"];
const districts = ["Hyderabad", "Karachi", "Sukkur", "Larkana", "Dadu", "Thatta", "Badin"];

export async function GET() {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "CEO or admin access required." }, { status: 403 });
  }

  const result = await query<EmployeeRow>(
    `select id, employee_code, email, full_name, phone, role, district, is_active, created_at
     from app_users
     where role <> 'public'
     order by created_at desc`
  );

  return NextResponse.json({ ok: true, data: result.rows.map(mapEmployee) });
}

export async function POST(request: Request) {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || user.role !== "ceo") {
    return NextResponse.json({ ok: false, message: "CEO access required." }, { status: 403 });
  }

  const body = (await request.json()) as EmployeeBody;
  const fullName = body.fullName?.trim() || "";
  const email = normalizeEmail(body.email || "");
  const phone = body.phone?.trim() || null;
  const role = body.role || "field_worker";
  const password = body.password || "";
  const district = body.district?.trim() || null;

  if (!fullName || !email || !password) {
    return NextResponse.json({ ok: false, message: "Full name, email, and password are required." }, { status: 400 });
  }

  if (!staffRoles.includes(role)) {
    return NextResponse.json({ ok: false, message: "Employee role must be admin, field worker, or lab officer." }, { status: 400 });
  }

  if ((role === "field_worker" || role === "lab_officer") && (!district || !districts.includes(district))) {
    return NextResponse.json({ ok: false, message: "District assignment is required for field and lab staff." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ ok: false, message: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { salt, hash } = hashPassword(password);
  const code = `ES-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    const result = await query<EmployeeRow>(
      `insert into app_users (employee_code, email, password_hash, salt, full_name, phone, role, district, is_active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true)
       returning id, employee_code, email, full_name, phone, role, district, is_active, created_at`,
      [code, email, hash, salt, fullName, phone, role, district]
    );

    const employee = result.rows[0];
    await writeAuditLog({
      actorId: user.id,
      action: "employee_created",
      entityType: "app_user",
      entityId: employee.id,
      message: `${user.fullName} created ${employee.full_name} as ${employee.role.replace("_", " ")}.`,
      metadata: { role: employee.role, district: employee.district, employeeCode: employee.employee_code }
    });

    return NextResponse.json({ ok: true, data: mapEmployee(employee), user: toAppUser({
      id: employee.id,
      email: employee.email,
      password_hash: "",
      salt: "",
      full_name: employee.full_name,
      phone: employee.phone,
      role: employee.role,
      employee_code: employee.employee_code,
      district: employee.district,
      is_active: employee.is_active
    }) });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("duplicate")
      ? "An account with this email or employee ID already exists."
      : "Could not create employee account.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  await ensureNeonSchema();
  const user = await getCurrentUser();
  if (!user || user.role !== "ceo") {
    return NextResponse.json({ ok: false, message: "CEO access required." }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string; isActive?: boolean };
  if (!body.id || typeof body.isActive !== "boolean") {
    return NextResponse.json({ ok: false, message: "Employee id and status are required." }, { status: 400 });
  }

  if (body.id === user.id && !body.isActive) {
    return NextResponse.json({ ok: false, message: "CEO cannot deactivate their own account." }, { status: 400 });
  }

  const result = await query<EmployeeRow>(
    `update app_users
     set is_active = $1
     where id = $2 and role <> 'public'
     returning id, employee_code, email, full_name, phone, role, district, is_active, created_at`,
    [body.isActive, body.id]
  );

  if (!result.rows[0]) {
    return NextResponse.json({ ok: false, message: "Employee not found." }, { status: 404 });
  }

  await writeAuditLog({
    actorId: user.id,
    action: body.isActive ? "employee_activated" : "employee_deactivated",
    entityType: "app_user",
    entityId: result.rows[0].id,
    message: `${user.fullName} ${body.isActive ? "activated" : "deactivated"} ${result.rows[0].full_name}.`,
    metadata: { employeeCode: result.rows[0].employee_code, role: result.rows[0].role }
  });

  return NextResponse.json({ ok: true, data: mapEmployee(result.rows[0]) });
}

function mapEmployee(row: EmployeeRow) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    district: row.district,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}
