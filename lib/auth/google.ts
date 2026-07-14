import { OAuth2Client } from "google-auth-library";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_STATE_COOKIE = "obc_google_oauth_state";
export const GOOGLE_REDIRECT_COOKIE = "obc_google_oauth_redirect";

export function getGoogleClient(redirectUri: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Google OAuth is not configured");
  return clientId;
}

export function getOAuthBaseUrl(requestOrigin: string): string {
  return (process.env.APP_URL || requestOrigin).replace(/\/$/, "");
}

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}
