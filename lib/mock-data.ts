import type { CityRisk, PublicReport, WaterTest } from "./types";

export const cityRisks: CityRisk[] = [
  {
    name: "Hyderabad",
    score: 72,
    level: "High",
    summary: "Drainage overflow reports and moderate rainfall probability.",
    x: 52,
    y: 45
  },
  {
    name: "Karachi",
    score: 48,
    level: "Moderate",
    summary: "Urban flooding risk in low-lying neighborhoods.",
    x: 41,
    y: 78
  },
  {
    name: "Sukkur",
    score: 64,
    level: "High",
    summary: "River-adjacent monitoring recommended.",
    x: 57,
    y: 22
  },
  {
    name: "Larkana",
    score: 58,
    level: "Moderate",
    summary: "Manual severity input suggests watch status.",
    x: 46,
    y: 17
  },
  {
    name: "Dadu",
    score: 83,
    level: "Critical",
    summary: "Multiple reports and vulnerable-area score elevated.",
    x: 44,
    y: 34
  },
  {
    name: "Thatta",
    score: 39,
    level: "Moderate",
    summary: "Coastal rainfall and access routes under review.",
    x: 54,
    y: 69
  },
  {
    name: "Badin",
    score: 67,
    level: "High",
    summary: "Standing water reports near vulnerable settlements.",
    x: 66,
    y: 68
  }
];

export const publicReports: PublicReport[] = [
  {
    city: "Dadu",
    type: "Flooding",
    severity: "Emergency",
    status: "New"
  },
  {
    city: "Hyderabad",
    type: "Drainage overflow",
    severity: "High",
    status: "Verified"
  },
  {
    city: "Badin",
    type: "Unsafe drinking water",
    severity: "High",
    status: "In progress"
  },
  {
    city: "Karachi",
    type: "Heavy rain damage",
    severity: "Medium",
    status: "New"
  }
];

export const waterTests: WaterTest[] = [
  {
    city: "Hyderabad",
    location: "Latifabad",
    ph: 7.4,
    tds: 420,
    turbidity: 2.1,
    residualChlorine: 0.3,
    eColiDetected: false,
    arsenic: 0.004,
    nitrate: 18,
    temperature: 27
  },
  {
    city: "Badin",
    location: "Ward 3",
    ph: 6.8,
    tds: 920,
    turbidity: 6.4,
    residualChlorine: 0.05,
    eColiDetected: true,
    arsenic: 0.012,
    nitrate: 42,
    temperature: 29
  },
  {
    city: "Dadu",
    location: "Union Council 6",
    ph: 8.7,
    tds: 740,
    turbidity: 4.9,
    residualChlorine: 0.12,
    eColiDetected: false,
    arsenic: 0.006,
    nitrate: 28,
    temperature: 31
  }
];

export const alerts = [
  {
    city: "Dadu",
    title: "Critical flood watch",
    message: "Field teams should monitor low-lying areas.",
    level: "Critical",
    status: "Active"
  },
  {
    city: "Hyderabad",
    title: "Drainage overflow risk",
    message: "Public reports increasing in Latifabad.",
    level: "High",
    status: "Active"
  },
  {
    city: "Karachi",
    title: "Rain preparedness notice",
    message: "Urban flooding possible in vulnerable pockets.",
    level: "Moderate",
    status: "Draft"
  }
];

export const waterThresholds = [
  { label: "pH", safe: "6.5 to 8.5" },
  { label: "TDS", safe: "Up to 500 mg/L preferred" },
  { label: "Turbidity", safe: "Under 5 NTU" },
  { label: "Residual chlorine", safe: "0.2 to 0.5 mg/L" },
  { label: "E. coli / coliform", safe: "Not detected" },
  { label: "Arsenic", safe: "Up to 0.01 mg/L" },
  { label: "Nitrate", safe: "Up to 50 mg/L" },
  { label: "Temperature", safe: "Recorded for context" }
];
