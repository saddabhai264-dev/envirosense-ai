import { NextResponse } from "next/server";
import { ensureNeonSchema, isNeonConfigured, query } from "@/lib/neon";

export async function GET() {
  if (!isNeonConfigured) {
    return NextResponse.json({
      configured: false,
      ok: false,
      message: "DATABASE_URL is missing."
    });
  }

  try {
    await ensureNeonSchema();
    const [reports, tests] = await Promise.all([
      query<{ count: string }>("select count(*) from public_reports"),
      query<{ count: string }>("select count(*) from water_tests")
    ]);

    return NextResponse.json({
      configured: true,
      ok: true,
      message: "Neon database is reachable.",
      counts: {
        publicReports: Number(reports.rows[0]?.count ?? 0),
        waterTests: Number(tests.rows[0]?.count ?? 0)
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        ok: false,
        message: error instanceof Error ? error.message : "Neon database check failed."
      },
      { status: 500 }
    );
  }
}
