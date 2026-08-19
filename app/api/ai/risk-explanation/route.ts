import { NextResponse } from "next/server";
import type { LiveRiskSnapshot, PublicReport, RiskIntelligence } from "@/lib/types";
import { generateStructuredJson, isOpenAiConfigured } from "@/lib/openai";

type RequestBody = {
  risk?: LiveRiskSnapshot;
  reports?: PublicReport[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;

  if (!body.risk) {
    return NextResponse.json(
      {
        ok: false,
        message: "Risk snapshot is required."
      },
      { status: 400 }
    );
  }

  const reports = (body.reports ?? []).filter((report) => report.city === body.risk?.city);
  const fallback = generateRiskIntelligence(body.risk, reports);

  if (isOpenAiConfigured) {
    try {
      const intelligence = await generateStructuredJson<RiskIntelligence>({
        schema: riskSchema,
        instructions:
          "You are EnviroSense AI, an NGO disaster response analyst for Sindh, Pakistan. Use cautious, practical language. Do not claim certainty. Return only schema-valid JSON.",
        input: {
          risk: body.risk,
          publicReports: reports,
          fallback
        }
      });

      return NextResponse.json({
        ok: true,
        engine: "OpenAI",
        data: { ...intelligence, generatedAt: new Date().toISOString() }
      });
    } catch (error) {
      return NextResponse.json({
        ok: true,
        engine: "Rule fallback",
        warning: error instanceof Error ? error.message : "OpenAI failed; fallback used.",
        data: fallback
      });
    }
  }

  return NextResponse.json({
    ok: true,
    engine: "Rule fallback",
    data: fallback
  });
}

const riskSchema = {
  name: "risk_intelligence",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      city: { type: "string" },
      headline: { type: "string" },
      summary: { type: "string" },
      confidence: { type: "string", enum: ["Low", "Medium", "High"] },
      urgency: { type: "string", enum: ["Monitor", "Prepare", "Respond", "Emergency"] },
      evidence: { type: "array", items: { type: "string" } },
      actions: { type: "array", items: { type: "string" } },
      publicMessage: { type: "string" },
      escalationTrigger: { type: "string" },
      generatedAt: { type: "string" }
    },
    required: [
      "city",
      "headline",
      "summary",
      "confidence",
      "urgency",
      "evidence",
      "actions",
      "publicMessage",
      "escalationTrigger",
      "generatedAt"
    ]
  }
};

function generateRiskIntelligence(risk: LiveRiskSnapshot, reports: PublicReport[]): RiskIntelligence {
  const emergencyReports = reports.filter((report) => report.severity === "Emergency").length;
  const highReports = reports.filter((report) => report.severity === "High").length;
  const unresolvedReports = reports.filter((report) => !["Resolved", "False/duplicate"].includes(report.status)).length;
  const reportPressure = Math.min(emergencyReports * 18 + highReports * 9 + unresolvedReports * 3, 30);
  const operationalScore = Math.min(risk.riskScore + reportPressure, 100);
  const urgency = getUrgency(operationalScore);
  const confidence = getConfidence(risk, reports.length);
  const evidence = [
    `${risk.forecastRainMm.toFixed(1)} mm forecast precipitation over the next 3 days.`,
    `${risk.precipitationProbability}% maximum precipitation probability.`,
    risk.nasaRainMm === null
      ? "NASA rainfall observation is currently unavailable."
      : `${risk.nasaRainMm.toFixed(1)} mm recent NASA POWER precipitation.`,
    `${unresolvedReports} unresolved public or field reports in ${risk.city}.`
  ];

  if (emergencyReports > 0) {
    evidence.push(`${emergencyReports} emergency-severity report(s) require immediate verification.`);
  }

  return {
    city: risk.city,
    headline: `${urgency} posture for ${risk.city}`,
    summary: buildSummary(risk, operationalScore, unresolvedReports),
    confidence,
    urgency,
    evidence,
    actions: buildActions(urgency, risk.city, emergencyReports),
    publicMessage: buildPublicMessage(urgency, risk.city),
    escalationTrigger: buildEscalationTrigger(urgency),
    generatedAt: new Date().toISOString()
  };
}

function getUrgency(score: number): RiskIntelligence["urgency"] {
  if (score >= 81) return "Emergency";
  if (score >= 61) return "Respond";
  if (score >= 31) return "Prepare";
  return "Monitor";
}

function getConfidence(risk: LiveRiskSnapshot, reportCount: number): RiskIntelligence["confidence"] {
  if (risk.source === "Open-Meteo + NASA POWER" && reportCount > 0) return "High";
  if (risk.source !== "Fallback" || reportCount > 0) return "Medium";
  return "Low";
}

function buildSummary(risk: LiveRiskSnapshot, operationalScore: number, unresolvedReports: number) {
  if (operationalScore >= 61) {
    return `${risk.city} needs active NGO response because environmental indicators and ${unresolvedReports} unresolved report(s) raise the operational risk to ${operationalScore}%.`;
  }

  if (operationalScore >= 31) {
    return `${risk.city} should remain in preparedness mode. Current environmental risk is ${risk.riskScore}%, with ${unresolvedReports} unresolved report(s) adding local pressure.`;
  }

  return `${risk.city} is currently low risk at ${risk.riskScore}%. Continue monitoring because conditions and public reports can change quickly.`;
}

function buildActions(urgency: RiskIntelligence["urgency"], city: string, emergencyReports: number) {
  if (urgency === "Emergency") {
    return [
      `Activate the ${city} incident lead and field verification team now.`,
      "Identify safe water, evacuation, and medical support points.",
      "Publish a verified web warning and reassess every 30 minutes.",
      "Escalate unresolved emergency reports to district authorities."
    ];
  }

  if (urgency === "Respond") {
    return [
      `Dispatch a field team to the highest-severity ${city} report.`,
      "Pre-position drinking water, test kits, and basic relief supplies.",
      "Verify drainage, low-lying settlements, and access routes.",
      "Recalculate risk every hour."
    ];
  }

  if (urgency === "Prepare") {
    return [
      `Place the ${city} field team on standby.`,
      "Verify public reports before publishing alerts.",
      "Check water-testing kits and relief inventory.",
      "Review forecast and satellite rainfall every 3 hours."
    ];
  }

  return [
    `Continue routine monitoring for ${city}.`,
    "Review new public reports for severity and duplication.",
    "Keep field contacts and water-testing equipment ready.",
    emergencyReports > 0 ? "Verify the emergency report despite low weather risk." : "Refresh environmental data every 6 hours."
  ];
}

function buildPublicMessage(urgency: RiskIntelligence["urgency"], city: string) {
  if (urgency === "Emergency") {
    return `Emergency conditions may affect parts of ${city}. Follow verified local instructions, avoid floodwater, and use only confirmed safe drinking water.`;
  }
  if (urgency === "Respond") {
    return `Elevated environmental risk is being monitored in ${city}. Avoid affected locations and report flooding or unsafe water through EnviroSense AI.`;
  }
  if (urgency === "Prepare") {
    return `Weather and field conditions in ${city} are under close monitoring. Keep emergency contacts and safe drinking water available.`;
  }
  return `No major environmental threat is currently indicated for ${city}. Continue following verified local updates.`;
}

function buildEscalationTrigger(urgency: RiskIntelligence["urgency"]) {
  if (urgency === "Emergency") return "Escalate immediately; do not wait for additional reports.";
  if (urgency === "Respond") return "Escalate if risk exceeds 80% or any verified life-safety report arrives.";
  if (urgency === "Prepare") return "Escalate if risk exceeds 60% or two high-severity reports are verified.";
  return "Escalate if risk exceeds 30% or an emergency report is verified.";
}
