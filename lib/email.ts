export type EmailResult = {
  status: "sent" | "failed" | "not_configured" | "skipped";
  message: string;
};

export async function sendAssignmentEmail({
  to,
  assigneeName,
  assignedByName,
  city,
  reportType,
  severity,
  priority,
  dueAt,
  notes
}: {
  to?: string | null;
  assigneeName?: string | null;
  assignedByName?: string | null;
  city: string;
  reportType: string;
  severity: string;
  priority: string;
  dueAt?: string | null;
  notes?: string | null;
}): Promise<EmailResult> {
  if (!to) return { status: "skipped", message: "Employee email is missing." };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { status: "not_configured", message: "Resend email credentials are missing." };
  }

  const text = [
    `Hello ${assigneeName || "Field Worker"},`,
    "",
    `${assignedByName || "EnviroSense AI admin"} assigned you a new field task.`,
    "",
    `City: ${city}`,
    `Report: ${reportType}`,
    `Severity: ${severity}`,
    `Priority: ${priority}`,
    dueAt ? `Due: ${new Date(dueAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}` : null,
    notes ? `Notes: ${notes}` : null,
    "",
    "Please open EnviroSense AI and update the assignment status after field action.",
    "",
    "EnviroSense AI"
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `assignment-${city}-${Date.now()}`
    },
    body: JSON.stringify({
      from,
      to,
      subject: `[EnviroSense AI] ${priority} task assigned - ${city}`,
      text
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { status: "failed", message: error || "Email provider rejected the request." };
  }

  return { status: "sent", message: `Assignment email sent to ${to}.` };
}
