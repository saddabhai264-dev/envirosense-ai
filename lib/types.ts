export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export type CityRisk = {
  name: string;
  score: number;
  level: RiskLevel;
  summary: string;
  x: number;
  y: number;
};

export type PublicReport = {
  id?: string;
  reporterName?: string;
  phone?: string;
  city: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  type: string;
  severity: "Low" | "Medium" | "High" | "Emergency";
  description?: string;
  affectedFamilies?: number | null;
  mediaUrl?: string | null;
  status: "New" | "Verified" | "In progress" | "Resolved" | "False/duplicate";
  createdAt?: string;
};

export type WaterTest = {
  id?: string;
  city: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  ph: number;
  tds: number;
  turbidity: number;
  residualChlorine: number;
  eColiDetected: boolean;
  arsenic: number;
  nitrate: number;
  temperature: number;
  result?: string;
  recommendation?: string;
  createdAt?: string;
};

export type WaterAssessment = {
  status: "Safe to drink" | "Needs filtration/treatment" | "Unsafe to drink";
  recommendation: string;
  reasons: string[];
};

export type LiveRiskSnapshot = {
  city: string;
  latitude: number;
  longitude: number;
  forecastRainMm: number;
  precipitationProbability: number;
  nasaRainMm: number | null;
  riskScore: number;
  level: RiskLevel;
  updatedAt: string;
  source: "Open-Meteo + NASA POWER" | "Open-Meteo" | "Fallback";
};

export type RiskIntelligence = {
  city: string;
  headline: string;
  summary: string;
  confidence: "Low" | "Medium" | "High";
  urgency: "Monitor" | "Prepare" | "Respond" | "Emergency";
  evidence: string[];
  actions: string[];
  publicMessage: string;
  escalationTrigger: string;
  generatedAt: string;
};

export type VulnerabilityScore = {
  city: string;
  score: number;
  level: RiskLevel;
  factors: {
    populationExposure: number;
    infrastructureWeakness: number;
    waterContamination: number;
    historicalFloodExposure: number;
    heatDroughtExposure: number;
  };
  primaryConcern: string;
};

export type HistoricalSimilarity = {
  eventId: string;
  eventName: string;
  disasterType: "Flood" | "Heatwave" | "Drought";
  similarity: number;
  matchedSignals: string[];
  warning: string;
};

export type ResourceRecommendation = {
  estimatedAffectedPeople: number;
  waterLitersPerDay: number;
  reliefCamps: number;
  medicalTeams: number;
  fieldTeams: number;
  waterTestingKits: number;
  priorities: string[];
};
