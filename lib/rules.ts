import type { WaterAssessment, WaterTest } from "./types";

export function getRiskTone(score: number) {
  if (score >= 81) return "critical";
  if (score >= 61) return "high";
  if (score >= 31) return "moderate";
  return "low";
}

export function assessWaterQuality(test: WaterTest): WaterAssessment {
  const reasons: string[] = [];

  if (test.eColiDetected) {
    reasons.push("E. coli or coliform detected.");
  }

  if (test.ph < 6.5 || test.ph > 8.5) {
    reasons.push("pH is outside the preferred drinking-water range.");
  }

  if (test.tds > 500) {
    reasons.push("TDS is above the preferred level.");
  }

  if (test.turbidity > 5) {
    reasons.push("Turbidity is high and needs filtration.");
  }

  if (test.residualChlorine < 0.2) {
    reasons.push("Residual chlorine is low for disinfection safety.");
  }

  if (test.arsenic > 0.01) {
    reasons.push("Arsenic is above the safety threshold.");
  }

  if (test.nitrate > 50) {
    reasons.push("Nitrate is above the safety threshold.");
  }

  if (test.eColiDetected || test.arsenic > 0.01 || test.nitrate > 50) {
    return {
      status: "Unsafe to drink",
      recommendation: "Do not drink without confirmed treatment and retesting.",
      reasons
    };
  }

  if (reasons.length > 0) {
    return {
      status: "Needs filtration/treatment",
      recommendation: "Treat the water, then repeat lab testing before public distribution.",
      reasons
    };
  }

  return {
    status: "Safe to drink",
    recommendation: "Continue routine monitoring.",
    reasons: ["All MVP safety checks are within the preferred range."]
  };
}
