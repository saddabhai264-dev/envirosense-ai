# EnviroSense AI - AI Handoff

Use this file when opening the project in ChatGPT, Claude, Codex, or with a new developer.

## One-Line Summary

EnviroSense AI is a web-based NGO command center for Sindh disaster response. It handles live flood/rainfall risk, public incident reporting, water quality checks, staff roles, assignments, audit logs, alerts, and optional AI/email/WhatsApp/media integrations.

## Current Production Status

- Live app: `https://envirosense-ai.vercel.app`
- Repository: `https://github.com/saddabhai264-dev/envirosense-ai`
- Cloud database: Neon Postgres
- Deployment: Vercel
- Core production MVP status: ready when `DATABASE_URL`, `CEO_EMAIL`, `CEO_PASSWORD`, and `OPEN_METEO_BASE_URL` are configured.
- Optional integrations: UploadThing, OpenAI API, Resend email, Meta WhatsApp Cloud API.

## What The App Already Covers

- Public users can create accounts and submit reports.
- Staff users log into a separate command interface.
- CEO/Admin can create employees and manage staff status.
- Roles supported: `ceo`, `admin`, `field_worker`, `lab_officer`, `public`.
- Public reports persist in Neon after refresh.
- Report status can be updated.
- Reports can be assigned to field workers.
- Field workers can view and update assignments.
- Lab/CEO/Admin can record water quality tests.
- Dashboard includes district risk intelligence for Hyderabad, Karachi, Sukkur, Larkana, Dadu, Thatta, and Badin.
- Live risk data uses Open-Meteo and NASA POWER public backend API calls.
- Historical disaster intelligence, vulnerability scoring, and NGO action recommendations are implemented with deterministic rules.
- OpenAI endpoints exist and fall back to rule-based intelligence when `OPENAI_API_KEY` is missing.
- Production health endpoint exists at `/api/production/health`.

## Important Architecture

- Framework: Next.js App Router
- Main UI: `app/dashboard-client.tsx`
- Main page: `app/page.tsx`
- Global styles: `app/globals.css`
- Database/schema helper: `lib/neon.ts`
- Auth/session helper: `lib/server-auth.ts`
- Email helper: `lib/email.ts`
- OpenAI helper: `lib/openai.ts`
- Live risk logic: `lib/live-risk.ts`
- Disaster rules/recommendations: `lib/disaster-intelligence.ts`
- Shared types: `lib/types.ts`

## Key API Routes

- `GET /api/production/health` - production readiness check
- `GET /api/neon/health` - Neon database check
- `POST /api/neon/setup` - ensure schema and CEO account
- `POST /api/auth/login` - custom login
- `POST /api/auth/signup` - public signup
- `POST /api/auth/logout` - logout
- `GET /api/auth/session` - current session
- `GET/POST /api/reports` - list/create public reports
- `PATCH /api/reports/[id]` - update report status
- `GET/POST/PATCH /api/employees` - staff management
- `GET/POST/PATCH /api/assignments` - field assignments
- `GET/POST /api/water-tests` - water quality tests
- `GET /api/risk/live` - live district risk
- `POST /api/ai/report-analysis` - AI/rule report triage
- `POST /api/ai/risk-explanation` - AI/rule district decision notes
- `GET /api/intelligence/historical` - historical disaster comparison
- `GET /api/intelligence/vulnerability` - district vulnerability score
- `GET /api/intelligence/resources` - NGO resource recommendations
- `POST /api/alerts/publish` - web/email/WhatsApp alert publishing

## Required Environment Variables

Minimum production MVP:

```env
DATABASE_URL=
CEO_EMAIL=saddabhai264@gmail.com
CEO_PASSWORD=
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1
```

Optional integrations:

```env
UPLOADTHING_TOKEN=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
RESEND_API_KEY=
ALERT_FROM_EMAIL=EnviroSense AI <alerts@yourdomain.com>
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_GRAPH_API_VERSION=v22.0
```

Do not commit real `.env.local` or production secrets.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Verification

```bash
npm run build
```

Then check:

```text
https://envirosense-ai.vercel.app/api/production/health
```

Expected for low-cost production MVP:

```json
{
  "configured": true,
  "ok": true,
  "score": 75
}
```

The score increases when optional UploadThing/OpenAI/Email/WhatsApp env vars are configured.

## Current Product Positioning

Pitch: EnviroSense AI helps NGOs and local response teams detect district-level environmental risk, collect public reports, verify water safety, assign field workers, and produce action recommendations before a crisis becomes worse.

Why it matters: people often hear about floods or water issues late, informally, and without a structured response workflow. This system turns scattered reports, weather signals, water tests, and staff action into one operational dashboard.

## Safe AI Prompt To Continue Work

Paste this into ChatGPT/Claude with the uploaded project:

```text
You are helping me continue EnviroSense AI, a Next.js 15 App Router project for Sindh NGO disaster response. Read AI_HANDOFF.md, README.md, package.json, app/dashboard-client.tsx, lib/neon.ts, lib/live-risk.ts, and lib/disaster-intelligence.ts first. Do not remove existing features. Preserve Neon custom auth and role separation. Keep UploadThing, OpenAI, Resend, and WhatsApp optional. Before editing, explain what files you will change. After editing, run npm run build and summarize changes.
```

## Next Best Improvements

- Add manual WhatsApp share links when Meta WhatsApp API is not configured.
- Add PDF/printable incident report export for NGO meetings.
- Add role-based route protection page states.
- Add cleaner mobile polish for the command dashboard.
- Add sample demo accounts page for controlled presentations.
- Add tests for auth, reports, assignments, and production health.
