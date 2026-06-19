import { NextResponse } from "next/server";
import { compareHistoricalDisasters } from "@/lib/disaster-intelligence";
import type { LiveRiskSnapshot, PublicReport, VulnerabilityScore } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    risk?: LiveRiskSnapshot;
    reports?: PublicReport[];
    vulnerability?: VulnerabilityScore;
  };

  if (!body.risk || !body.vulnerability) {
    return NextResponse.json({ ok: false, message: "Risk and vulnerability are required." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    data: compareHistoricalDisasters(body.risk, body.reports ?? [], body.vulnerability),
    generatedAt: new Date().toISOString()
  });
}
