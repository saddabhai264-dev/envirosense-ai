import type {
  HistoricalSimilarity,
  LiveRiskSnapshot,
  PublicReport,
  ResourceRecommendation,
  RiskLevel,
  VulnerabilityScore,
  WaterTest
} from "./types";

type DistrictProfile = {
  city: string;
  populationExposure: number;
  infrastructureWeakness: number;
  historicalFloodExposure: number;
  heatDroughtExposure: number;
  baselineWaterRisk: number;
  primaryConcern: string;
};

const districtProfiles: DistrictProfile[] = [
  { city: "Hyderabad", populationExposure: 78, infrastructureWeakness: 66, historicalFloodExposure: 62, heatDroughtExposure: 69, baselineWaterRisk: 72, primaryConcern: "Dense settlements, drainage pressure, and drinking-water contamination." },
  { city: "Karachi", populationExposure: 96, infrastructureWeakness: 70, historicalFloodExposure: 67, heatDroughtExposure: 76, baselineWaterRisk: 68, primaryConcern: "Very high population exposure, urban flooding, heat, and water-service disruption." },
  { city: "Sukkur", populationExposure: 58, infrastructureWeakness: 55, historicalFloodExposure: 78, heatDroughtExposure: 82, baselineWaterRisk: 61, primaryConcern: "River exposure, extreme heat, and drought-sensitive water supplies." },
  { city: "Larkana", populationExposure: 52, infrastructureWeakness: 68, historicalFloodExposure: 84, heatDroughtExposure: 80, baselineWaterRisk: 70, primaryConcern: "High flood history, heat stress, and vulnerable rural settlements." },
  { city: "Dadu", populationExposure: 48, infrastructureWeakness: 82, historicalFloodExposure: 94, heatDroughtExposure: 77, baselineWaterRisk: 76, primaryConcern: "Severe historical flood exposure, weak access routes, and unsafe water after inundation." },
  { city: "Thatta", populationExposure: 44, infrastructureWeakness: 76, historicalFloodExposure: 88, heatDroughtExposure: 72, baselineWaterRisk: 78, primaryConcern: "Coastal and river flooding, dispersed settlements, and saline water exposure." },
  { city: "Badin", populationExposure: 46, infrastructureWeakness: 80, historicalFloodExposure: 91, heatDroughtExposure: 74, baselineWaterRisk: 84, primaryConcern: "Flooding, saline/contaminated water, and limited resilient infrastructure." }
];

const historicalEvents = [
  {
    eventId: "sindh-flood-2022",
    eventName: "2022 Sindh Flood",
    disasterType: "Flood" as const,
    signature: { rain: 95, probability: 90, nasaRain: 90, reports: 85, water: 88, heatDrought: 20 },
    warning: "Similarity indicates compound flood, access, displacement, and contaminated-water risk."
  },
  {
    eventId: "sindh-flood-2011",
    eventName: "2011 Sindh Flood",
    disasterType: "Flood" as const,
    signature: { rain: 82, probability: 84, nasaRain: 80, reports: 72, water: 78, heatDrought: 18 },
    warning: "Similarity indicates prolonged rainfall with rural inundation and waterborne-disease pressure."
  },
  {
    eventId: "karachi-heatwave-2015",
    eventName: "2015 Karachi Heatwave",
    disasterType: "Heatwave" as const,
    signature: { rain: 5, probability: 8, nasaRain: 5, reports: 45, water: 60, heatDrought: 98 },
    warning: "Similarity indicates dangerous heat exposure, dehydration, and medical surge risk."
  },
  {
    eventId: "sindh-drought-2018",
    eventName: "2018 Sindh Drought",
    disasterType: "Drought" as const,
    signature: { rain: 2, probability: 8, nasaRain: 4, reports: 48, water: 82, heatDrought: 92 },
    warning: "Similarity indicates water scarcity, livestock stress, malnutrition, and unsafe-source dependence."
  }
];

export function calculateVulnerabilityScores(reports: PublicReport[], tests: WaterTest[]): VulnerabilityScore[] {
  return districtProfiles.map((profile) => {
    const cityTests = tests.filter((test) => test.city === profile.city);
    const unsafeTests = cityTests.filter((test) =>
      test.eColiDetected || test.arsenic > 0.01 || test.turbidity > 5 || test.tds > 500
    ).length;
    const waterContamination = cityTests.length
      ? Math.round((unsafeTests / cityTests.length) * 100)
      : profile.baselineWaterRisk;
    const severeReports = reports.filter(
      (report) => report.city === profile.city && ["High", "Emergency"].includes(report.severity)
    ).length;
    const reportPressure = Math.min(severeReports * 4, 12);
    const score = Math.min(
      Math.round(
        profile.populationExposure * 0.22 +
          profile.infrastructureWeakness * 0.24 +
          waterContamination * 0.2 +
          profile.historicalFloodExposure * 0.22 +
          profile.heatDroughtExposure * 0.12 +
          reportPressure
      ),
      100
    );

    return {
      city: profile.city,
      score,
      level: toLevel(score),
      factors: {
        populationExposure: profile.populationExposure,
        infrastructureWeakness: profile.infrastructureWeakness,
        waterContamination,
        historicalFloodExposure: profile.historicalFloodExposure,
        heatDroughtExposure: profile.heatDroughtExposure
      },
      primaryConcern: profile.primaryConcern
    };
  });
}

export function compareHistoricalDisasters(
  risk: LiveRiskSnapshot,
  reports: PublicReport[],
  vulnerability: VulnerabilityScore
): HistoricalSimilarity[] {
  const cityReports = reports.filter((report) => report.city === risk.city);
  const severeReports = cityReports.filter((report) => ["High", "Emergency"].includes(report.severity)).length;
  const current = {
    rain: normalize(risk.forecastRainMm, 60),
    probability: risk.precipitationProbability,
    nasaRain: normalize(risk.nasaRainMm ?? 0, 35),
    reports: Math.min(severeReports * 22 + cityReports.length * 6, 100),
    water: vulnerability.factors.waterContamination,
    heatDrought: vulnerability.factors.heatDroughtExposure
  };

  return historicalEvents
    .map((event) => {
      const keys = Object.keys(event.signature) as Array<keyof typeof current>;
      const distance = keys.reduce((total, key) => total + Math.abs(current[key] - event.signature[key]), 0) / keys.length;
      const similarity = Math.max(0, Math.min(100, Math.round(100 - distance)));
      const matchedSignals = keys
        .filter((key) => Math.abs(current[key] - event.signature[key]) <= 25)
        .map((key) => signalLabel(key));
      return {
        eventId: event.eventId,
        eventName: event.eventName,
        disasterType: event.disasterType,
        similarity,
        matchedSignals,
        warning: event.warning
      };
    })
    .sort((left, right) => right.similarity - left.similarity);
}

export function recommendResources(
  risk: LiveRiskSnapshot,
  vulnerability: VulnerabilityScore,
  reports: PublicReport[]
): ResourceRecommendation {
  const cityReports = reports.filter((report) => report.city === risk.city);
  const reportedFamilies = cityReports.reduce((total, report) => total + (report.affectedFamilies ?? 0), 0);
  const severityWeight = cityReports.reduce(
    (total, report) => total + ({ Low: 1, Medium: 2, High: 4, Emergency: 8 }[report.severity] ?? 1),
    0
  );
  const estimatedFamilies = Math.max(reportedFamilies, Math.ceil((risk.riskScore + vulnerability.score + severityWeight) / 5));
  const estimatedAffectedPeople = estimatedFamilies * 6;
  const waterLitersPerDay = Math.ceil(estimatedAffectedPeople * 3);
  const reliefCamps = risk.riskScore + vulnerability.score >= 145 ? Math.max(1, Math.ceil(estimatedAffectedPeople / 500)) : 0;
  const medicalTeams = Math.max(1, Math.ceil((estimatedAffectedPeople + severityWeight * 20) / 800));
  const fieldTeams = Math.max(1, Math.ceil((cityReports.length + severityWeight) / 5));
  const waterTestingKits = Math.max(2, Math.ceil(estimatedAffectedPeople / 250));

  const priorities = [
    vulnerability.factors.waterContamination >= 65 ? "Distribute safe drinking water and test community sources." : "Monitor drinking-water sources.",
    risk.riskScore >= 60 ? "Open or identify relief-camp locations above flood level." : "Keep relief locations on standby.",
    severityWeight >= 8 ? "Deploy a medical assessment team to severe reports." : "Keep medical referral contacts ready.",
    vulnerability.factors.infrastructureWeakness >= 70 ? "Inspect road access, drainage, and evacuation routes." : "Confirm field access routes."
  ];

  return {
    estimatedAffectedPeople,
    waterLitersPerDay,
    reliefCamps,
    medicalTeams,
    fieldTeams,
    waterTestingKits,
    priorities
  };
}

export function getDistrictProfile(city: string) {
  return districtProfiles.find((profile) => profile.city === city);
}

function normalize(value: number, high: number) {
  return Math.min(100, Math.round((value / high) * 100));
}

function toLevel(score: number): RiskLevel {
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 31) return "Moderate";
  return "Low";
}

function signalLabel(key: string) {
  return {
    rain: "forecast rainfall",
    probability: "rain probability",
    nasaRain: "recent satellite rainfall",
    reports: "incident report pressure",
    water: "water contamination",
    heatDrought: "heat/drought exposure"
  }[key] ?? key;
}
