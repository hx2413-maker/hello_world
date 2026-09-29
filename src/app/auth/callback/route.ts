import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isProfileComplete } from "@/lib/auth";
import { getAuthOrigin } from "@/lib/auth-origin";

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
  return redirectWithoutCaching(
    isProfileComplete(profile) ? "/members" : "/profile",
    origin,
  );
}
