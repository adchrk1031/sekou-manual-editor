import { NextRequest, NextResponse } from "next/server";

function resolveRedirectUri(request: NextRequest): string {
  const envUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (envUri) {
    return envUri;
  }
  const origin = new URL(request.url).origin;
  return `${origin}/api/auth/google/callback`;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.redirect(new URL("/?google_error=config", request.url));
  }

  const state = crypto.randomUUID();
  const redirectUri = resolveRedirectUri(request);
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("sekou_google_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}

