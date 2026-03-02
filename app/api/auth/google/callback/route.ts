import { NextRequest, NextResponse } from "next/server";

type GoogleUserInfo = {
  email?: string;
  name?: string;
  email_verified?: boolean;
};

function resolveRedirectUri(request: NextRequest): string {
  const envUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (envUri) {
    return envUri;
  }
  const origin = new URL(request.url).origin;
  return `${origin}/api/auth/google/callback`;
}

function redirectWithError(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/?google_error=${encodeURIComponent(code)}`, request.url));
  response.cookies.delete("sekou_google_state");
  return response;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return redirectWithError(request, "config");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("sekou_google_state")?.value;
  if (!code || !state || !savedState || state !== savedState) {
    return redirectWithError(request, "state");
  }

  const redirectUri = resolveRedirectUri(request);
  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  let accessToken = "";
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
      cache: "no-store",
    });
    if (!tokenResponse.ok) {
      return redirectWithError(request, "token");
    }
    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    accessToken = tokenJson.access_token ?? "";
  } catch {
    return redirectWithError(request, "token");
  }

  if (!accessToken) {
    return redirectWithError(request, "token");
  }

  let profile: GoogleUserInfo = {};
  try {
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) {
      return redirectWithError(request, "userinfo");
    }
    profile = (await profileResponse.json()) as GoogleUserInfo;
  } catch {
    return redirectWithError(request, "userinfo");
  }

  if (!profile.email || profile.email_verified === false) {
    return redirectWithError(request, "email");
  }

  const responseUrl = new URL("/", request.url);
  responseUrl.searchParams.set("google", "ok");
  responseUrl.searchParams.set("email", profile.email);
  if (profile.name) {
    responseUrl.searchParams.set("name", profile.name);
  }
  const response = NextResponse.redirect(responseUrl);
  response.cookies.delete("sekou_google_state");
  return response;
}

