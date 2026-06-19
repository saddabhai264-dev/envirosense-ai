import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({
      configured: false,
      ok: false,
      message: "Supabase environment keys are missing."
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [reports, tests] = await Promise.all([
    supabase.from("public_reports").select("id", { count: "exact", head: true }),
    supabase.from("water_tests").select("id", { count: "exact", head: true })
  ]);

  const error = reports.error || tests.error;

  if (error) {
    return NextResponse.json(
      {
        configured: true,
        ok: false,
        message: error.message
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    configured: true,
    ok: true,
    message: "Supabase connection and MVP tables are reachable.",
    counts: {
      publicReports: reports.count ?? 0,
      waterTests: tests.count ?? 0
    }
  });
}
