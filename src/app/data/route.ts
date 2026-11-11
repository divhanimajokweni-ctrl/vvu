import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.redirect(new URL("/console#/home", "http://localhost:3000"));
}
