# EnviroSense AI

EnviroSense AI is a web-based NGO command system for Sindh disaster response: live flood/rainfall intelligence, public incident reporting, water quality checks, employee roles, assignments, audit logs, notifications, and alerts.

## Stack

- Next.js App Router
- Neon Postgres for cloud data
- Custom cookie auth with CEO/Admin/Field Worker/Lab Officer/Public roles
- UploadThing for report evidence media
- Open-Meteo + NASA POWER backend risk data
- OpenAI Responses API for real AI triage and decision notes
- Resend email support for employee assignment notifications
- Optional WhatsApp Cloud API alert delivery

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`.

Required for a share-ready deployment:

```env
DATABASE_URL=
CEO_EMAIL=saddabhai264@gmail.com
CEO_PASSWORD=
UPLOADTHING_TOKEN=
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

Recommended:

```env
RESEND_API_KEY=
ALERT_FROM_EMAIL=EnviroSense AI <alerts@yourdomain.com>
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_GRAPH_API_VERSION=v22.0
```

## Production Check

After setting env vars on Vercel and redeploying, open the CEO dashboard and click `Production Check`.

The check validates:

- Neon database and schema
- UploadThing token
- Email notification env
- WhatsApp alert env
- Weather/NASA risk API readiness

## Vercel Env Setup

In Vercel project settings, add these to **Production**:

- `DATABASE_URL`
- `CEO_EMAIL`
- `CEO_PASSWORD`
- `UPLOADTHING_TOKEN`
- `OPEN_METEO_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `META_WHATSAPP_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_GRAPH_API_VERSION`

Redeploy after adding env vars.

## Demo Flow

1. Sign in as CEO.
2. Click `Production Check`.
3. Create a field worker in Employees.
4. Submit a public report.
5. Assign the report to the field worker.
6. Show assignment email status and audit timeline.
7. Log in as field worker and update task status.
8. Add a water test as lab officer or CEO/Admin.
