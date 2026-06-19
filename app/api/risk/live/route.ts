import { NextResponse } from "next/server";
import { fetchLiveRiskSnapshots } from "@/lib/live-risk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshots = await fetchLiveRiskSnapshots();

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      source: "Open-Meteo + NASA POWER",
      data: snapshots
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Could not fetch live risk data."
      },
      { status: 502 }
    );
  }
}
