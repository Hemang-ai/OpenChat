import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/jwt";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/embed",
  "/api/auth",
  "/api/public",
  "/widget.js",
  "/_next",
  "/favicon.ico",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPublic) return NextResponse.next();

  const session = getSessionFromRequest(request);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
