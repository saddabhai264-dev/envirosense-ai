-- EnviroSense AI proper Supabase Auth migration.
-- Run this file in Supabase SQL Editor.

alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type text using role::text;

alter table public.profiles
  alter column role set default 'public';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('ceo', 'admin', 'field_worker', 'public'));

alter table public.profiles
  add column if not exists phone text;

alter table public.public_reports
  add column if not exists reporter_id uuid references auth.users(id) on delete set null;

create index if not exists public_reports_reporter_id_idx
  on public.public_reports(reporter_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    case
      when new.raw_user_meta_data ->> 'role' = 'field_worker' then 'field_worker'
      else 'public'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Staff can read profiles" on public.profiles;
create policy "Staff can read profiles"
on public.profiles for select
to authenticated
using (public.current_user_role() in ('ceo', 'admin'));

drop policy if exists "Anyone can submit public reports" on public.public_reports;
drop policy if exists "Anyone can read public reports" on public.public_reports;
drop policy if exists "Anyone can update report status in MVP" on public.public_reports;
drop policy if exists "Authenticated users can submit reports" on public.public_reports;
drop policy if exists "Public users can read own reports" on public.public_reports;
drop policy if exists "Staff can update reports" on public.public_reports;

create policy "Authenticated users can submit reports"
on public.public_reports for insert
to authenticated
with check (reporter_id = auth.uid());

create policy "Public users can read own reports"
on public.public_reports for select
to authenticated
using (
  reporter_id = auth.uid()
  or public.current_user_role() in ('ceo', 'admin', 'field_worker')
);

create policy "Staff can update reports"
on public.public_reports for update
to authenticated
using (public.current_user_role() in ('ceo', 'admin', 'field_worker'))
with check (public.current_user_role() in ('ceo', 'admin', 'field_worker'));

drop policy if exists "Anyone can submit water tests in MVP" on public.water_tests;
drop policy if exists "Anyone can read water tests" on public.water_tests;
drop policy if exists "Staff can insert water tests" on public.water_tests;
drop policy if exists "Staff can read water tests" on public.water_tests;

create policy "Staff can insert water tests"
on public.water_tests for insert
to authenticated
with check (
  public.current_user_role() in ('ceo', 'admin', 'field_worker')
  and created_by = auth.uid()
);

create policy "Staff can read water tests"
on public.water_tests for select
to authenticated
using (public.current_user_role() in ('ceo', 'admin', 'field_worker'));

drop policy if exists "Anyone can upload report media" on storage.objects;
drop policy if exists "Authenticated users can upload report media" on storage.objects;
create policy "Authenticated users can upload report media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'report-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Anyone can read report media" on storage.objects;
drop policy if exists "Authenticated users can read report media" on storage.objects;
create policy "Authenticated users can read report media"
on storage.objects for select
to authenticated
using (bucket_id = 'report-media');

drop policy if exists "Staff can publish web alerts" on public.web_alerts;
create policy "Staff can publish web alerts"
on public.web_alerts for insert
to authenticated
with check (
  public.current_user_role() in ('ceo', 'admin')
  and created_by = auth.uid()
);

-- After creating the CEO user in Authentication > Users, promote it by email:
-- update public.profiles
-- set role = 'ceo'
-- where id = (select id from auth.users where email = 'ceo@example.com');
