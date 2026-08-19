import { NextResponse } from "next/server";
import { generateStructuredJson, isOpenAiConfigured } from "@/lib/openai";
import type { PublicReport, ReportAiAnalysis } from "@/lib/types";

type RequestBody = {
  report?: PublicReport;
  relatedReports?: PublicReport[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  if (!body.report) {
    return NextResponse.json({ ok: false, message: "Report is required." }, { status: 400 });
  }

  const fallback = generateFallbackReportAnalysis(body.report, body.relatedReports ?? []);

  if (isOpenAiConfigured) {
    try {
      const analysis = await generateStructuredJson<Omit<ReportAiAnalysis, "engine">>({
        schema: reportSchema,
        instructions:
          "You are EnviroSense AI, supporting an NGO in Sindh, Pakistan. Analyze public environmental reports for triage. Be practical, concise, and avoid overclaiming. Return only schema-valid JSON.",
        input: {
          report: body.report,
          relatedReports: body.relatedReports ?? [],
          fallback
        }
      });

      return NextResponse.json({
        ok: true,
        engine: "OpenAI",
        data: { ...analysis, engine: "OpenAI", generatedAt: new Date().toISOString() }
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

  return NextResponse.json({ ok: true, engine: "Rule fallback", data: fallback });
}

function generateFallbackReportAnalysis(report: PublicReport, relatedReports: PublicReport[]): ReportAiAnalysis {
  const urgent = report.severity === "Emergency" || report.severity === "High";
  const similarOpen = relatedReports.filter((item) => item.city === report.city && item.status !== "Resolved").length;

  return {
    reportId: report.id,
    headline: `${report.severity} ${report.type} signal in ${report.city}`,
    severityExplanation: urgent
      ? `${report.severity} severity should be treated as operationally urgent because the report may affect safety, access, water, or households. ${similarOpen} related open report(s) add local pressure.`
      : `This report is currently lower priority, but it should still be verified because environmental conditions can change quickly.`,
    recommendedActions: urgent
      ? [
          "Call the reporter or local contact to verify location and immediate danger.",
          "Assign a field worker for location verification and photos.",
          "Prepare water, medical, or evacuation support if verification confirms risk.",
          "Escalate to district coordination if life safety or major flooding is confirmed."
        ]
      : [
          "Check for duplicate reports in the same area.",
          "Monitor the location and request more evidence if needed.",
          "Keep the case open until a field worker or admin verifies it."
        ],
    publicMessageDraft: urgent
      ? `A ${report.severity.toLowerCase()} environmental report has been received for ${report.city}. Avoid affected areas and follow verified local updates.`
      : `An environmental report has been received for ${report.city}. EnviroSense AI is monitoring and verifying the information.`,
    escalationTrigger: urgent
      ? "Escalate if the reporter confirms danger to people, contaminated drinking water, road blockage, or rising water."
      : "Escalate if more reports arrive from the same area or severity increases.",
    confidence: report.description || report.mediaUrl ? "Medium" : "Low",
    generatedAt: new Date().toISOString(),
    engine: "Rule fallback"
  };
}

const reportSchema = {
  name: "report_ai_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reportId: { type: ["string", "null"] },
      headline: { type: "string" },
      severityExplanation: { type: "string" },
      recommendedActions: { type: "array", items: { type: "string" } },
      publicMessageDraft: { type: "string" },
      escalationTrigger: { type: "string" },
      confidence: { type: "string", enum: ["Low", "Medium", "High"] },
      generatedAt: { type: "string" }
    },
    required: [
      "reportId",
      "headline",
      "severityExplanation",
      "recommendedActions",
      "publicMessageDraft",
      "escalationTrigger",
      "confidence",
      "generatedAt"
    ]
  }
};
