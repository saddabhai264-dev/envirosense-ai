# EnviroSense AI

EnviroSense AI is a web-based NGO operations dashboard for Sindh disaster early warning, water quality screening, public reporting, and web alerts.

## MVP Stack

- Next.js for the web app
- Supabase-ready data model for auth, PostgreSQL, and storage
- Open-Meteo-ready weather integration
- Rule-based flood and water safety scoring for the first MVP
- Backend API route for live Open-Meteo + NASA POWER risk data

## Run Locally

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` when Supabase is connected.

## Connect Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `docs/RUN_THIS_IN_SUPABASE.sql`. This creates empty cloud tables without demo data.
3. Copy `.env.example` to `.env.local`.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Restart the dev server.
6. Open the dashboard and click `Test Supabase`.

The MVP policies are intentionally permissive so public reports and water tests can be submitted without login. Tighten these policies when admin authentication is added.

Without Supabase keys, reports and water tests persist in the current browser through `localStorage`. This makes demos usable immediately, but cloud sync starts only after Supabase is configured.

Detailed setup: `docs/supabase-connect.md`.

## Live Risk API

The dashboard calls `/api/risk/live`. The browser does not call NASA/Open-Meteo directly.

## Alerts

CEO alerts can publish to web, email, and WhatsApp through `/api/alerts/publish`.

Provider setup: `docs/alerts-setup.md`.

## Authentication

Supabase Auth provides staff login, public signup/login, session persistence, password recovery, and role-based access.

One-time cloud setup: `docs/AUTH_SETUP_STEPS.md`.
