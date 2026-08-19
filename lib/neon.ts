import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var envirosensePool: Pool | undefined;
}

export const isNeonConfigured = Boolean(process.env.DATABASE_URL);

export const pool =
  global.envirosensePool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    max: 5
  });

if (process.env.NODE_ENV !== "production") {
  global.envirosensePool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function ensureNeonSchema() {
  if (!isNeonConfigured) {
    throw new Error("DATABASE_URL is missing.");
  }

  await query(`
    create extension if not exists pgcrypto;

    create table if not exists app_users (
      id uuid primary key default gen_random_uuid(),
      employee_code text unique,
      email text not null unique,
      password_hash text not null,
      salt text not null,
      full_name text not null,
      phone text,
      role text not null check (role in ('ceo', 'admin', 'field_worker', 'lab_officer', 'public')),
      district text,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );

    alter table app_users add column if not exists employee_code text unique;
    alter table app_users add column if not exists district text;
    alter table app_users add column if not exists is_active boolean not null default true;
    alter table app_users drop constraint if exists app_users_role_check;
    alter table app_users add constraint app_users_role_check check (role in ('ceo', 'admin', 'field_worker', 'lab_officer', 'public'));

    create table if not exists app_sessions (
      token_hash text primary key,
      user_id uuid not null references app_users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );

    create index if not exists app_sessions_user_idx on app_sessions(user_id);
    create index if not exists app_sessions_expires_idx on app_sessions(expires_at);

    create table if not exists public_reports (
      id uuid primary key default gen_random_uuid(),
      reporter_id uuid references app_users(id) on delete set null,
      reporter_name text,
      phone text,
      city text not null,
      location_text text,
      latitude numeric,
      longitude numeric,
      report_type text not null,
      severity text not null check (severity in ('Low', 'Medium', 'High', 'Emergency')),
      description text,
      affected_families integer,
      media_url text,
      status text not null default 'New' check (status in ('New', 'Verified', 'In progress', 'Resolved', 'False/duplicate')),
      created_at timestamptz not null default now()
    );

    create index if not exists public_reports_city_idx on public_reports(city);
    create index if not exists public_reports_status_idx on public_reports(status);
    create index if not exists public_reports_reporter_idx on public_reports(reporter_id);
    create index if not exists public_reports_created_idx on public_reports(created_at desc);

    create table if not exists report_assignments (
      id uuid primary key default gen_random_uuid(),
      report_id uuid not null references public_reports(id) on delete cascade,
      assigned_to uuid references app_users(id) on delete set null,
      assigned_by uuid references app_users(id) on delete set null,
      priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')),
      due_at timestamptz,
      notes text,
      status text not null default 'Assigned' check (status in ('Assigned', 'In progress', 'Completed', 'Blocked')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists report_assignments_report_idx on report_assignments(report_id);
    create index if not exists report_assignments_assigned_to_idx on report_assignments(assigned_to);
    create index if not exists report_assignments_status_idx on report_assignments(status);

    create table if not exists audit_logs (
      id uuid primary key default gen_random_uuid(),
      actor_id uuid references app_users(id) on delete set null,
      action text not null,
      entity_type text not null,
      entity_id uuid,
      message text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists audit_logs_actor_idx on audit_logs(actor_id);
    create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id);
    create index if not exists audit_logs_created_idx on audit_logs(created_at desc);

    create table if not exists water_tests (
      id uuid primary key default gen_random_uuid(),
      city text not null,
      location_text text not null,
      latitude numeric,
      longitude numeric,
      ph numeric not null,
      tds numeric not null,
      turbidity numeric not null,
      residual_chlorine numeric not null,
      e_coli_detected boolean not null default false,
      arsenic numeric not null,
      nitrate numeric not null,
      temperature numeric not null,
      result text not null,
      recommendation text not null,
      created_by uuid references app_users(id) on delete set null,
      created_at timestamptz not null default now()
    );

    create index if not exists water_tests_city_idx on water_tests(city);
    create index if not exists water_tests_created_idx on water_tests(created_at desc);

    create table if not exists web_alerts (
      id uuid primary key default gen_random_uuid(),
      city text not null,
      title text not null,
      message text not null,
      level text not null,
      status text not null default 'Active',
      published_at timestamptz not null default now(),
      created_by uuid references app_users(id) on delete set null
    );
  `);
}
