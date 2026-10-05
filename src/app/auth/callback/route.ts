import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isProfileComplete } from "@/lib/auth";
import { getAuthOrigin } from "@/lib/auth-origin";
import { AUTH_NEXT_COOKIE, getPostSignInPath } from "@/lib/auth-next";

function redirectWithoutCaching(path: string, origin: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getAuthOrigin(request.headers, { requestUrl: request.url });
  const code = searchParams.get("code");

  if (!code || searchParams.has("error")) {
    return redirectWithoutCaching("/login?error=auth", origin);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectWithoutCaching("/login?error=auth", origin);
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    return redirectWithoutCaching("/login?error=auth", origin);
  }

  // Keep the authenticated session if the profile service is briefly unavailable;
  // the profile page can explain the problem and offer a retry.
  const profile = await getProfile(data.user.id).catch(() => null);
  const profileComplete = isProfileComplete(profile);
  const next = (await cookies()).get(AUTH_NEXT_COOKIE)?.value;
  const response = redirectWithoutCaching(
    getPostSignInPath(next, profileComplete),
    origin,
  );
  // Onboarding retains the short-lived intent until a complete profile is saved.
  if (profileComplete) response.cookies.delete(AUTH_NEXT_COOKIE);
  return response;
}
