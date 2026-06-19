import type { LiveRiskSnapshot, RiskLevel } from "./types";

export const cityCoordinates = [
  { city: "Hyderabad", latitude: 25.396, longitude: 68.3578 },
  { city: "Karachi", latitude: 24.8607, longitude: 67.0011 },
  { city: "Sukkur", latitude: 27.7052, longitude: 68.8574 },
  { city: "Larkana", latitude: 27.559, longitude: 68.2123 },
  { city: "Dadu", latitude: 26.7329, longitude: 67.7763 },
  { city: "Thatta", latitude: 24.7475, longitude: 67.9235 },
  { city: "Badin", latitude: 24.6558, longitude: 68.8383 }
];

const fallbackScores: Record<string, number> = {
  Hyderabad: 72,
  Karachi: 48,
  Sukkur: 64,
  Larkana: 58,
  Dadu: 83,
  Thatta: 39,
  Badin: 67
};

type OpenMeteoResponse = {
  daily?: {
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
  };
};

type NasaPowerResponse = {
  properties?: {
    parameter?: {
      PRECTOTCORR?: Record<string, number>;
    };
  };
};

export async function fetchLiveRiskSnapshots(): Promise<LiveRiskSnapshot[]> {
  return Promise.all(cityCoordinates.map(fetchCityRisk));
}

async function fetchCityRisk(location: (typeof cityCoordinates)[number]): Promise<LiveRiskSnapshot> {
  const [forecast, nasaRainMm] = await Promise.all([
    fetchOpenMeteoForecast(location.latitude, location.longitude),
    fetchNasaPowerRain(location.latitude, location.longitude)
  ]);

  const forecastRainMm = forecast?.rainMm ?? 0;
  const precipitationProbability = forecast?.probability ?? 0;
  const hasLiveData = Boolean(forecast) || nasaRainMm !== null;
  const riskScore = hasLiveData
    ? calculateLiveRiskScore(forecastRainMm, precipitationProbability, nasaRainMm)
    : fallbackScores[location.city] ?? 35;

  return {
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    forecastRainMm,
    precipitationProbability,
    nasaRainMm,
    riskScore,
    level: toRiskLevel(riskScore),
    updatedAt: new Date().toISOString(),
    source: !hasLiveData ? "Fallback" : nasaRainMm === null ? "Open-Meteo" : "Open-Meteo + NASA POWER"
  };
}

async function fetchOpenMeteoForecast(latitude: number, longitude: number) {
  try {
    const baseUrl = process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com/v1";
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      daily: "precipitation_sum,precipitation_probability_max",
      forecast_days: "3",
      timezone: "auto"
    });
    const response = await fetch(`${baseUrl}/forecast?${params.toString()}`, {
      next: { revalidate: 900 }
    });
    if (!response.ok) return null;

    const data = (await response.json()) as OpenMeteoResponse;
    const precipitation = data.daily?.precipitation_sum ?? [];
    const probabilities = data.daily?.precipitation_probability_max ?? [];

    return {
      rainMm: precipitation.reduce((total, value) => total + (Number(value) || 0), 0),
      probability: Math.max(...probabilities.map((value) => Number(value) || 0), 0)
    };
  } catch {
    return null;
  }
}

async function fetchNasaPowerRain(latitude: number, longitude: number) {
  try {
    const date = new Date();
    date.setDate(date.getDate() - 2);
    const end = formatDate(date);
    date.setDate(date.getDate() - 2);
    const start = formatDate(date);

    const params = new URLSearchParams({
      parameters: "PRECTOTCORR",
      community: "AG",
      longitude: longitude.toString(),
      latitude: latitude.toString(),
      start,
      end,
      format: "JSON",
      "time-standard": "UTC"
    });
    const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${params.toString()}`, {
      next: { revalidate: 3600 }
    });
    if (!response.ok) return null;

    const data = (await response.json()) as NasaPowerResponse;
    const values = Object.values(data.properties?.parameter?.PRECTOTCORR ?? {})
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > -900);

    if (!values.length) return null;
    return values.reduce((total, value) => total + value, 0);
  } catch {
    return null;
  }
}

function calculateLiveRiskScore(forecastRainMm: number, probability: number, nasaRainMm: number | null) {
  const forecastComponent = Math.min(forecastRainMm * 2.3, 48);
  const probabilityComponent = Math.min(probability * 0.35, 35);
  const satelliteComponent = Math.min((nasaRainMm ?? 0) * 1.2, 22);
  return Math.min(Math.round(forecastComponent + probabilityComponent + satelliteComponent), 100);
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 31) return "Moderate";
  return "Low";
}

function formatDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
