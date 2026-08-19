import { NextResponse } from "next/server";
import { ensureNeonSchema, isNeonConfigured, query } from "@/lib/neon";

type ServiceCheck = {
  key: string;
  label: string;
  ok: boolean;
  required: boolean;
  message: string;
};

export async function GET() {
  const checks: ServiceCheck[] = [];
  let counts: { publicReports: number; waterTests: number; assignments: number; auditLogs: number } | undefined;

  if (!isNeonConfigured) {
    checks.push({
      key: "database",
      label: "Neon database",
      ok: false,
      required: true,
      message: "DATABASE_URL is missing."
    });
  } else {
    try {
      await ensureNeonSchema();
      const [reports, tests, assignments, logs] = await Promise.all([
        query<{ count: string }>("select count(*) from public_reports"),
        query<{ count: string }>("select count(*) from water_tests"),
        query<{ count: string }>("select count(*) from report_assignments"),
        query<{ count: string }>("select count(*) from audit_logs")
      ]);

      counts = {
        publicReports: Number(reports.rows[0]?.count ?? 0),
        waterTests: Number(tests.rows[0]?.count ?? 0),
        assignments: Number(assignments.rows[0]?.count ?? 0),
        auditLogs: Number(logs.rows[0]?.count ?? 0)
      };

      checks.push({
        key: "database",
        label: "Neon database",
        ok: true,
        required: true,
        message: "Cloud database reachable and schema ready."
      });
    } catch (error) {
      checks.push({
        key: "database",
        label: "Neon database",
        ok: false,
        required: true,
        message: error instanceof Error ? error.message : "Database check failed."
      });
    }
  }

  checks.push(
    envCheck(
      "uploadthing",
      "UploadThing evidence media",
      "UPLOADTHING_TOKEN",
      false,
      "Optional: report text, status, and assignments still save to Neon without media upload."
    ),
    envCheck(
      "openai",
      "OpenAI real AI",
      "OPENAI_API_KEY",
      false,
      "Optional: rule-based severity, action, and risk intelligence remains active without OpenAI API billing."
    ),
    envPairCheck(
      "email",
      "Employee/alert email",
      "RESEND_API_KEY",
      "ALERT_FROM_EMAIL",
      false,
      "Optional: web notifications and dashboard assignments still work without email delivery."
    ),
    envPairCheck(
      "whatsapp",
      "WhatsApp alerts",
      "META_WHATSAPP_TOKEN",
      "META_WHATSAPP_PHONE_NUMBER_ID",
      false,
      "Optional: use manual WhatsApp/copy message flow until Meta Cloud API is approved."
    ),
    {
      key: "weather",
      label: "Weather/NASA risk API",
      ok: true,
      required: true,
      message: "Open-Meteo and NASA POWER use public backend API calls."
    }
  );

  const required = checks.filter((check) => check.required);
  const requiredReady = required.every((check) => check.ok);
  const optional = checks.filter((check) => !check.required);
  const optionalReady = optional.filter((check) => check.ok).length;
  const score = requiredReady
    ? Math.min(100, 75 + Math.round((optionalReady / Math.max(optional.length, 1)) * 25))
    : Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);

  return NextResponse.json({
    configured: requiredReady,
    ok: requiredReady,
    score,
    message: requiredReady
      ? "Core production is ready. Optional integrations can be added as the project scales."
      : "Production essentials need attention before sharing.",
    services: checks,
    counts
  });
}

function envCheck(key: string, label: string, envName: string, required: boolean, fallbackMessage?: string): ServiceCheck {
  const ok = Boolean(process.env[envName]);
  return {
    key,
    label,
    ok,
    required,
    message: ok ? `${envName} is configured.` : fallbackMessage ?? `${envName} is missing.`
  };
}

function envPairCheck(
  key: string,
  label: string,
  left: string,
  right: string,
  required: boolean,
  fallbackMessage?: string
): ServiceCheck {
  const missing = [left, right].filter((name) => !process.env[name]);
  return {
    key,
    label,
    ok: missing.length === 0,
    required,
    message: missing.length ? fallbackMessage ?? `Missing: ${missing.join(", ")}.` : `${left} and ${right} are configured.`
  };
}
