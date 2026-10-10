import type { PublicReport, WaterTest } from "./types";

export const supportedCities = ["Hyderabad", "Karachi", "Sukkur", "Larkana", "Dadu", "Thatta", "Badin"] as const;
const reportSeverities: PublicReport["severity"][] = ["Low", "Medium", "High", "Emergency"];

export function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function requestIsTooLarge(request: Request, maxBytes = 100_000) {
  const length = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(length) && length > maxBytes;
}

export function optionalFiniteNumber(value: unknown, min: number, max: number) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

export function validateReportBody(body: Record<string, unknown>) {
  const city = cleanText(body.city, 80);
  const location = cleanText(body.location, 300);
  const type = cleanText(body.type, 100);
  const description = cleanText(body.description, 3000);
  const reporterName = cleanText(body.reporterName, 120);
  const phone = cleanText(body.phone, 40);
  const severity = body.severity as PublicReport["severity"];
  const latitude = optionalFiniteNumber(body.latitude, -90, 90);
  const longitude = optionalFiniteNumber(body.longitude, -180, 180);
  const affectedFamilies = optionalFiniteNumber(body.affectedFamilies, 0, 1_000_000);
  const mediaUrl = cleanText(body.mediaUrl, 2000);

  if (!supportedCities.includes(city as (typeof supportedCities)[number])) return { error: "Choose a supported city." };
  if (!location || !type || !description) return { error: "Location, report type, and description are required." };
  if (!reportSeverities.includes(severity)) return { error: "Choose a valid severity." };
  if (latitude === undefined || longitude === undefined) return { error: "Coordinates are outside the valid range." };
  if (affectedFamilies === undefined || (affectedFamilies !== null && !Number.isInteger(affectedFamilies))) {
    return { error: "Affected families must be a non-negative whole number." };
  }
  if (mediaUrl) {
    try {
      const url = new URL(mediaUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return { error: "Evidence URL must use HTTP or HTTPS." };
    } catch {
      return { error: "Evidence URL is invalid." };
    }
  }

  return {
    data: {
      reporterName,
      phone,
      city,
      location,
      latitude: latitude === null ? "" : String(latitude),
      longitude: longitude === null ? "" : String(longitude),
      type,
      severity,
      description,
      affectedFamilies: affectedFamilies === null ? "" : String(affectedFamilies),
      mediaUrl: mediaUrl || null
    }
  };
}

export function validateWaterTest(body: Record<string, unknown>): { data?: WaterTest; error?: string } {
  const city = cleanText(body.city, 80);
  const location = cleanText(body.location, 300);
  if (!supportedCities.includes(city as (typeof supportedCities)[number]) || !location) {
    return { error: "A supported city and location are required." };
  }

  const fields = {
    ph: optionalFiniteNumber(body.ph, 0, 14),
    tds: optionalFiniteNumber(body.tds, 0, 100_000),
    turbidity: optionalFiniteNumber(body.turbidity, 0, 100_000),
    residualChlorine: optionalFiniteNumber(body.residualChlorine, 0, 1000),
    arsenic: optionalFiniteNumber(body.arsenic, 0, 1000),
    nitrate: optionalFiniteNumber(body.nitrate, 0, 100_000),
    temperature: optionalFiniteNumber(body.temperature, -20, 100)
  };

  if (Object.values(fields).some((value) => value === null || value === undefined)) {
    return { error: "Enter valid numeric water-test measurements." };
  }

  return {
    data: {
      city,
      location,
      ph: fields.ph!,
      tds: fields.tds!,
      turbidity: fields.turbidity!,
      residualChlorine: fields.residualChlorine!,
      eColiDetected: body.eColiDetected === true,
      arsenic: fields.arsenic!,
      nitrate: fields.nitrate!,
      temperature: fields.temperature!
    }
  };
}
