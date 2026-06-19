# Supabase Connection Checklist

## 1. Create Project

Create a Supabase project and wait until the database is ready.

## 2. Run Cloud SQL

Open Supabase SQL Editor and run:

```sql
-- paste the full contents of docs/RUN_THIS_IN_SUPABASE.sql
```

This creates empty production-style tables, policies, indexes, and the report media storage bucket. It does not insert demo data.

## 3. Add Environment Keys

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1
```

Find these values in Supabase:

- Project Settings
- API
- Project URL
- Project API keys
- `anon` `public`

## 4. Restart Dev Server

Stop the current dev server and run:

```bash
npm run dev
```

## 5. Verify

Open the dashboard and click `Test Supabase`.

Success means:

- env keys are loaded
- `public_reports` table is reachable
- `water_tests` table is reachable
- form submissions will persist after refresh and across devices
