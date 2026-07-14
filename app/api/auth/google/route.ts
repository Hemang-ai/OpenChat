import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleClient,
  getOAuthBaseUrl,
  GOOGLE_REDIRECT_COOKIE,
  GOOGLE_STATE_COOKIE,
  safeRedirectPath,
} from "@/lib/auth/google";

const OAUTH_COOKIE_MAX_AGE = 10 * 60;

export async function GET(request: NextRequest) {
  try {
    const baseUrl = getOAuthBaseUrl(request.nextUrl.origin);
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const state = randomBytes(32).toString("base64url");
    const returnTo = safeRedirectPath(request.nextUrl.searchParams.get("redirect"));
    const client = getGoogleClient(redirectUri);
    const authorizationUrl = client.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state,
      prompt: "select_account",
    });

    const response = NextResponse.redirect(authorizationUrl);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: OAUTH_COOKIE_MAX_AGE,
      path: "/",
    };
    response.cookies.set(GOOGLE_STATE_COOKIE, state, cookieOptions);
    response.cookies.set(GOOGLE_REDIRECT_COOKIE, returnTo, cookieOptions);
    return response;
  } catch (error) {
    console.error("Google OAuth start error:", error);
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }
}
