import { NextResponse } from "next/server";
import { ensureNeonSchema, query } from "@/lib/neon";
import { getCurrentUser } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit-log";

type AlertRequest = {
  city?: string;
  title?: string;
  message?: string;
  level?: string;
  emailRecipients?: string[];
  whatsappRecipients?: string[];
};

type ChannelResult = {
  status: "sent" | "failed" | "not_configured" | "skipped";
  message: string;
};

export async function POST(request: Request) {
  await ensureNeonSchema();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Authenticated staff access required." }, { status: 401 });
  }

  if (!["ceo", "admin"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "CEO or admin access required." }, { status: 403 });
  }

  const body = (await request.json()) as AlertRequest;
  const city = body.city?.trim();
  const title = body.title?.trim();
  const message = body.message?.trim();
  const level = body.level?.trim();

  if (!city || !title || !message || !level) {
    return NextResponse.json({ ok: false, message: "City, title, message, and level are required." }, { status: 400 });
  }

  const [web, email, whatsapp] = await Promise.all([
    saveWebAlert(user.id, { city, title, message, level }),
    sendEmails(body.emailRecipients ?? [], { city, title, message, level }),
    sendWhatsApp(body.whatsappRecipients ?? [], { city, title, message, level })
  ]);

  await writeAuditLog({
    actorId: user.id,
    action: "alert_published",
    entityType: "web_alert",
    message: `${user.fullName} published ${level} alert for ${city}.`,
    metadata: {
      city,
      title,
      level,
      webStatus: web.status,
      emailStatus: email.status,
      whatsappStatus: whatsapp.status
    }
  });

  return NextResponse.json({
    ok: web.status === "sent",
    channels: { web, email, whatsapp }
  });
}

async function saveWebAlert(
  userId: string,
  alert: { city: string; title: string; message: string; level: string }
): Promise<ChannelResult> {
  try {
    await query(
      `insert into web_alerts (city, title, message, level, status, published_at, created_by)
       values ($1, $2, $3, $4, 'Active', now(), $5)`,
      [alert.city, alert.title, alert.message, alert.level, userId]
    );
    return { status: "sent", message: "Web alert published to Neon." };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Could not save web alert."
    };
  }
}

async function sendEmails(
  recipients: string[],
  alert: { city: string; title: string; message: string; level: string }
): Promise<ChannelResult> {
  if (!recipients.length) return { status: "skipped", message: "No email recipients selected." };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  if (!apiKey || !from) {
    return { status: "not_configured", message: "Resend email credentials are missing." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `envirosense-${Date.now()}`
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `[${alert.level}] ${alert.title} - ${alert.city}`,
      text: `${alert.message}\n\nLocation: ${alert.city}\nLevel: ${alert.level}\nSource: EnviroSense AI`
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { status: "failed", message: error || "Email provider rejected the request." };
  }

  return { status: "sent", message: `Email sent to ${recipients.length} recipient(s).` };
}

async function sendWhatsApp(
  recipients: string[],
  alert: { city: string; title: string; message: string; level: string }
): Promise<ChannelResult> {
  if (!recipients.length) return { status: "skipped", message: "No WhatsApp recipients selected." };

  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_GRAPH_API_VERSION || "v22.0";

  if (!token || !phoneNumberId) {
    return { status: "not_configured", message: "WhatsApp Cloud API credentials are missing." };
  }

  const text = `*${alert.level}: ${alert.title}*\n${alert.city}\n${alert.message}\n\nEnviroSense AI`;
  const results = await Promise.all(
    recipients.map((recipient) =>
      fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient.replace(/[^\d]/g, ""),
          type: "text",
          text: { preview_url: false, body: text }
        })
      })
    )
  );

  const failed = results.filter((response) => !response.ok).length;
  return failed
    ? { status: "failed", message: `${failed} of ${recipients.length} WhatsApp message(s) failed.` }
    : { status: "sent", message: `WhatsApp sent to ${recipients.length} recipient(s).` };
}
