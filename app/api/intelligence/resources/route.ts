import { NextResponse } from "next/server";
import { recommendResources } from "@/lib/disaster-intelligence";
import type { LiveRiskSnapshot, PublicReport, VulnerabilityScore } from "@/lib/types";
import { getCurrentUser } from "@/lib/server-auth";
import { requestIsTooLarge } from "@/lib/request-validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "public") return NextResponse.json({ ok: false, message: "Staff access required." }, { status: 403 });
  if (requestIsTooLarge(request)) return NextResponse.json({ ok: false, message: "Request is too large." }, { status: 413 });
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
    data: recommendResources(body.risk, body.vulnerability, (body.reports ?? []).slice(0, 100)),
    generatedAt: new Date().toISOString()
  });
}
