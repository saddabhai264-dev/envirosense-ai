import { NextResponse } from "next/server";
import { fetchLiveRiskSnapshots } from "@/lib/live-risk";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["ceo", "admin", "field_worker"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "Response staff access required." }, { status: 403 });
  }
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
