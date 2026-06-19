-- EnviroSense AI Cloud Database Setup
-- Paste this full file into Supabase SQL Editor and run it.
-- This creates empty production-style tables, policies, indexes, and storage.
-- It does NOT insert demo data.

do $$
begin
  create type public.user_role as enum ('admin', 'field_worker');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_status as enum ('New', 'Verified', 'In progress', 'Resolved', 'False/duplicate');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_severity as enum ('Low', 'Medium', 'High', 'Emergency');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.alert_status as enum ('Draft', 'Active', 'Archived');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'field_worker',
  created_at timestamptz not null default now()
);

create table if not exists public.public_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_name text,
  phone text,
  city text not null,
  location_text text,
  latitude double precision,
  longitude double precision,
  report_type text not null,
  severity public.report_severity not null,
  description text not null,
  affected_families integer,
  media_url text,
  status public.report_status not null default 'New',
  created_at timestamptz not null default now()
);

create index if not exists public_reports_city_idx on public.public_reports(city);
create index if not exists public_reports_status_idx on public.public_reports(status);
create index if not exists public_reports_created_at_idx on public.public_reports(created_at desc);

create table if not exists public.water_tests (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  location_text text not null,
  latitude double precision,
  longitude double precision,
  ph numeric(4, 2) not null,
  tds numeric(8, 2) not null,
  turbidity numeric(8, 2) not null,
  residual_chlorine numeric(6, 3) not null,
  e_coli_detected boolean not null,
  arsenic numeric(8, 4) not null,
  nitrate numeric(8, 2) not null,
  temperature numeric(5, 2) not null,
  result text not null,
  recommendation text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists water_tests_city_idx on public.water_tests(city);
create index if not exists water_tests_created_at_idx on public.water_tests(created_at desc);

create table if not exists public.flood_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  rainfall_forecast_mm numeric(8, 2) not null default 0,
  precipitation_probability integer not null default 0,
  past_24h_rainfall_mm numeric(8, 2) not null default 0,
  public_report_count integer not null default 0,
  manual_severity integer not null default 0,
  vulnerable_area_score integer not null default 0,
  risk_score integer not null,
  risk_level text not null,
  created_at timestamptz not null default now()
);

create index if not exists flood_risk_snapshots_city_idx on public.flood_risk_snapshots(city);
create index if not exists flood_risk_snapshots_created_at_idx on public.flood_risk_snapshots(created_at desc);

create table if not exists public.web_alerts (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  title text not null,
  message text not null,
  level text not null,
  status public.alert_status not null default 'Draft',
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists web_alerts_city_idx on public.web_alerts(city);
create index if not exists web_alerts_status_idx on public.web_alerts(status);

alter table public.public_reports enable row level security;
alter table public.water_tests enable row level security;
alter table public.web_alerts enable row level security;

drop policy if exists "Anyone can submit public reports" on public.public_reports;
create policy "Anyone can submit public reports"
on public.public_reports
for insert
to anon, authenticated
with check (true);

drop policy if exists "Anyone can read public reports" on public.public_reports;
create policy "Anyone can read public reports"
on public.public_reports
for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can update report status in MVP" on public.public_reports;
create policy "Anyone can update report status in MVP"
on public.public_reports
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Anyone can submit water tests in MVP" on public.water_tests;
create policy "Anyone can submit water tests in MVP"
on public.water_tests
for insert
to anon, authenticated
with check (true);

drop policy if exists "Anyone can read water tests" on public.water_tests;
create policy "Anyone can read water tests"
on public.water_tests
for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can read active web alerts" on public.web_alerts;
create policy "Anyone can read active web alerts"
on public.web_alerts
for select
to anon, authenticated
using (status = 'Active');

insert into storage.buckets (id, name, public)
values ('report-media', 'report-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Anyone can upload report media" on storage.objects;
create policy "Anyone can upload report media"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'report-media');

drop policy if exists "Anyone can read report media" on storage.objects;
create policy "Anyone can read report media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'report-media');
