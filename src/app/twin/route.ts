import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export async function GET() {
  // serve the telemetry analytics digital-twin HTML from the Free City package
  // (the 1.7MB city twin + rig + map surface)
  try {
    const html = await readFile(path.join(process.cwd(), "public", "freecity", "telemetry-dashboard.html"), "utf8");
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch {
    // fallback: serve the freecity telemetry dashboard if available
    try {
      const fc = await readFile(path.join(process.cwd(), "public", "freecity", "road-run.html"), "utf8");
      return new NextResponse(fc, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    } catch {
      return new NextResponse("<h1>Twin view — loading</h1>", { status: 200, headers: { "Content-Type": "text/html" } });
    }
  }
}
