import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export async function GET() {
  const dir = path.join(process.cwd(), "public", "nmu-walk-evidence", "NMU_Walk_Evidence_20260914-15_BLOOD");
  let files: string[] = [];
  try { files = (await readdir(dir)).filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.json')); } catch {}
  const fileList = files.map(f => `<li><a href="/nmu-walk-evidence/NMU_Walk_Evidence_20260914-15_BLOOD/${f}">${f}</a></li>`).join('');
  return new NextResponse(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>VVU · Evidence</title><style>body{background:#0c0b09;color:#f0ead6;font-family:monospace;padding:40px;max-width:900px;margin:0 auto}h1{font-family:serif;font-size:2em;margin-bottom:20px}li{margin:8px 0}a{color:#f59e0b;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><h1>VVU · Field Evidence — NMU Walk Captures</h1><p>2026-09-14 · Nelson Mandela University, Port Elizabeth · T1 evidence</p><ul>${fileList}</ul></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
