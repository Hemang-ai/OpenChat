import { NextResponse } from "next/server";
import { COOKIE_NAME_EXPORT } from "@/lib/auth/jwt";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME_EXPORT, "", { maxAge: 0, path: "/" });
  return response;
}
