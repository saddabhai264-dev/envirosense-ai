# Email and WhatsApp Alert Setup

## Web Alerts

Web alert publishing uses the signed-in CEO/admin Supabase session and RLS. A service-role key is not required.

## Email with Resend

1. Create a Resend account.
2. Verify a sending domain.
3. Create an API key.
4. Add:

```env
RESEND_API_KEY=
ALERT_FROM_EMAIL=EnviroSense AI <alerts@yourdomain.com>
```

## WhatsApp Cloud API

1. Create a Meta developer app.
2. Add the WhatsApp product.
3. Copy the access token and phone number ID.
4. Add:

```env
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_GRAPH_API_VERSION=v22.0
```

For production outbound alerts outside WhatsApp's customer-service window, configure and use an approved message template.

## Restart

Restart the Next.js server after changing `.env.local`.

The CEO alert composer reports each channel independently as `sent`, `failed`, `not configured`, or `skipped`.
