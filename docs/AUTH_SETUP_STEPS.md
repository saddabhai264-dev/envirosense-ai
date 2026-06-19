# Supabase Authentication Setup

## 1. Run Auth Migration

In Supabase:

1. Open SQL Editor.
2. Create a new query.
3. Paste the full contents of `docs/SUPABASE_AUTH_MIGRATION.sql`.
4. Click Run.

This preserves existing reports and water tests.

## 2. Create CEO Account

In Supabase:

1. Open Authentication.
2. Open Users.
3. Click Add user.
4. Choose Create new user.
5. Enter the CEO's real email and password.
6. Enable Auto Confirm User.
7. Create the user.

## 3. Promote CEO Role

Run this in SQL Editor, replacing the email:

```sql
update public.profiles
set role = 'ceo'
where id = (
  select id from auth.users where email = 'YOUR_CEO_EMAIL'
);
```

Confirm it:

```sql
select p.id, u.email, p.full_name, p.role
from public.profiles p
join auth.users u on u.id = p.id;
```

## 4. Public Accounts

Public users create their own accounts from the EnviroSense AI login screen.

Supabase can require email confirmation:

1. Open Authentication.
2. Open Providers.
3. Select Email.
4. Enable or disable Confirm email based on the deployment stage.

For an MVP demo, disabling confirmation is easier. For production, keep confirmation enabled.

## 5. Field Workers

Create each field worker in Authentication > Users, then run:

```sql
update public.profiles
set role = 'field_worker'
where id = (
  select id from auth.users where email = 'FIELD_WORKER_EMAIL'
);
```

Valid roles are `ceo`, `admin`, `field_worker`, and `public`.
