import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.redirect(new URL("/console#/onboarding", "http://localhost:3000"));
}
