# Upload Package Checklist

Use this before uploading the project folder to ChatGPT, Claude, or another developer.

## Safe To Upload

- `app/`
- `components/`
- `lib/`
- `docs/`
- `README.md`
- `AI_HANDOFF.md`
- `package.json`
- `package-lock.json`
- `next.config.mjs`
- `tsconfig.json`
- `.env.example`

## Do Not Upload

- `.env.local`
- `.env`
- `.next/`
- `node_modules/`
- `.vercel/`
- `.git/`
- log files such as `dev-3001.log`

These files either contain secrets, machine-specific metadata, or bulky generated output.

## Best Way To Share With Another AI

1. Create a copy of the project folder.
2. Delete `.env.local`, `.next`, `node_modules`, `.vercel`, `.git`, and logs from the copy.
3. Zip the cleaned copy.
4. Upload the zip.
5. Tell the AI to read `AI_HANDOFF.md` first.

## Environment Setup Reminder

Never paste production secrets publicly. If an AI/developer needs env vars, give only names first:

```env
DATABASE_URL=
CEO_EMAIL=
CEO_PASSWORD=
OPEN_METEO_BASE_URL=
UPLOADTHING_TOKEN=
OPENAI_API_KEY=
RESEND_API_KEY=
ALERT_FROM_EMAIL=
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
```

Only provide real values in a trusted private environment.
