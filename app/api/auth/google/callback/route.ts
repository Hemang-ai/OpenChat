import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { COOKIE_NAME_EXPORT, signToken } from "@/lib/auth/jwt";
import {
  getGoogleClient,
  getGoogleClientId,
  getOAuthBaseUrl,
  GOOGLE_PROVIDER,
  GOOGLE_REDIRECT_COOKIE,
  GOOGLE_STATE_COOKIE,
  safeRedirectPath,
} from "@/lib/auth/google";
import { slugify } from "@/lib/utils/validation";

function errorResponse(request: NextRequest, code: string): NextResponse {
  const baseUrl = getOAuthBaseUrl(request.nextUrl.origin);
  const response = NextResponse.redirect(`${baseUrl}/login?error=${code}`);
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  response.cookies.delete(GOOGLE_REDIRECT_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  if (request.nextUrl.searchParams.has("error")) {
    return errorResponse(request, "google_access_denied");
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return errorResponse(request, "google_invalid_state");
  }

  try {
    const baseUrl = getOAuthBaseUrl(request.nextUrl.origin);
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const client = getGoogleClient(redirectUri);
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new Error("Google did not return an ID token");

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: getGoogleClientId(),
    });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      return errorResponse(request, "google_unverified_email");
    }

    const email = profile.email.toLowerCase();
    const name = profile.name?.trim() || email.split("@")[0];
    const user = await db.$transaction(async (tx) => {
      const account = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: GOOGLE_PROVIDER,
            providerAccountId: profile.sub,
          },
        },
        include: { user: true },
      });
      if (account) return account.user;

      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        await tx.oAuthAccount.create({
          data: {
            provider: GOOGLE_PROVIDER,
            providerAccountId: profile.sub,
            userId: existingUser.id,
          },
        });
        return existingUser;
      }

      const workspaceName = `${name}'s Workspace`;
      return tx.user.create({
        data: {
          email,
          name,
          oauthAccounts: {
            create: {
              provider: GOOGLE_PROVIDER,
              providerAccountId: profile.sub,
            },
          },
          workspaces: {
            create: {
              name: workspaceName,
              slug: `${slugify(workspaceName)}-${randomBytes(3).toString("hex")}`,
            },
          },
        },
      });
    });

    const token = signToken({ userId: user.id, email: user.email });
    const returnTo = safeRedirectPath(
      request.cookies.get(GOOGLE_REDIRECT_COOKIE)?.value
    );
    const response = NextResponse.redirect(`${baseUrl}${returnTo}`);
    response.cookies.set(COOKIE_NAME_EXPORT, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    response.cookies.delete(GOOGLE_STATE_COOKIE);
    response.cookies.delete(GOOGLE_REDIRECT_COOKIE);
    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return errorResponse(request, "google_auth_failed");
  }
}
