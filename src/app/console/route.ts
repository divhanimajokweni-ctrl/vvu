import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Serve the unified console HTML verbatim. This is a complete standalone
// HTML file (238KB, 4689 lines) with inline CSS + JS. It's the landing
// page — everything goes under it.
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "vvu-console.html");
  const html = await readFile(filePath, "utf8");
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
