import type { PublicReport, WaterTest } from "./types";

type ReportRow = {
  id: string;
  reporter_name: string | null;
  phone: string | null;
  city: string;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  report_type: string;
  severity: PublicReport["severity"];
  description: string | null;
  affected_families: number | null;
  media_url: string | null;
  status: PublicReport["status"];
  created_at: string;
};

type WaterTestRow = {
  id: string;
  city: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  ph: number;
  tds: number;
  turbidity: number;
  residual_chlorine: number;
  e_coli_detected: boolean;
  arsenic: number;
  nitrate: number;
  temperature: number;
  result: string;
  recommendation: string;
  created_at: string;
};

export function mapReportRow(row: ReportRow): PublicReport {
  return {
    id: row.id,
    reporterName: row.reporter_name ?? "",
    phone: row.phone ?? "",
    city: row.city,
    location: row.location_text ?? "",
    latitude: row.latitude,
    longitude: row.longitude,
    type: row.report_type,
    severity: row.severity,
    description: row.description ?? "",
    affectedFamilies: row.affected_families,
    mediaUrl: row.media_url,
    status: row.status,
    createdAt: row.created_at
  };
}

export function mapWaterTestRow(row: WaterTestRow): WaterTest {
  return {
    id: row.id,
    city: row.city,
    location: row.location_text,
    latitude: row.latitude,
    longitude: row.longitude,
    ph: Number(row.ph),
    tds: Number(row.tds),
    turbidity: Number(row.turbidity),
    residualChlorine: Number(row.residual_chlorine),
    eColiDetected: row.e_coli_detected,
    arsenic: Number(row.arsenic),
    nitrate: Number(row.nitrate),
    temperature: Number(row.temperature),
    result: row.result,
    recommendation: row.recommendation,
    createdAt: row.created_at
  };
}

export function publicReportInsertPayload(report: {
  reporterName: string;
  phone: string;
  city: string;
  location: string;
  latitude: string;
  longitude: string;
  type: string;
  severity: PublicReport["severity"];
  description: string;
  affectedFamilies: string;
  mediaUrl?: string | null;
  reporterId?: string | null;
}) {
  return {
    reporter_name: report.reporterName || null,
    phone: report.phone || null,
    city: report.city,
    location_text: report.location,
    latitude: optionalNumber(report.latitude),
    longitude: optionalNumber(report.longitude),
    report_type: report.type,
    severity: report.severity,
    description: report.description,
    affected_families: optionalInteger(report.affectedFamilies),
    media_url: report.mediaUrl ?? null,
    reporter_id: report.reporterId ?? null,
    status: "New" as const
  };
}

export function waterTestInsertPayload(test: WaterTest, createdBy?: string | null) {
  return {
    city: test.city,
    location_text: test.location,
    latitude: test.latitude ?? null,
    longitude: test.longitude ?? null,
    ph: test.ph,
    tds: test.tds,
    turbidity: test.turbidity,
    residual_chlorine: test.residualChlorine,
    e_coli_detected: test.eColiDetected,
    arsenic: test.arsenic,
    nitrate: test.nitrate,
    temperature: test.temperature,
    result: test.result ?? "",
    recommendation: test.recommendation ?? "",
    created_by: createdBy ?? null
  };
}

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
