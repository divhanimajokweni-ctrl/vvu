import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public", "freecity", "road-run.html"), "utf8");
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
