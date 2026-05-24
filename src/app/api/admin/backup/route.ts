import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/logbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Check auth
  const token = request.headers.get("cookie")?.split(";")
    .find((c) => c.trim().startsWith("sb-auth-token="))
    ?.split("=")[1];
  
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser(decodeURIComponent(token));
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all tables using the service role key via our logbook functions or direct API
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`
  };

  try {
    const fetchTable = async (table: string) => {
      const res = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch ${table}`);
      return res.json();
    };

    const [profiles, records, categories, templates, config] = await Promise.all([
      fetchTable("profiles"),
      fetchTable("logbook_records"),
      fetchTable("instrument_categories"),
      fetchTable("instrument_templates"),
      fetchTable("app_config")
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        profiles,
        logbook_records: records,
        instrument_categories: categories,
        instrument_templates: templates,
        app_config: config
      }
    };

    // Return as a downloadable JSON file
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="lab-logbook-backup-${new Date().toISOString().slice(0, 10)}.json"`
      }
    });

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
