"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthOrigin } from "@/lib/auth-origin";
import { AUTH_NEXT_COOKIE, AUTH_NEXT_MAX_AGE, getSafeAuthNext } from "@/lib/auth-next";

export async function signInWithGoogle(formData: FormData) {
  const origin = getAuthOrigin(await headers(), { verifyRequestOrigin: true });
  const cookieStore = await cookies();
  const next = getSafeAuthNext(formData.get("next"));
  if (next) {
    cookieStore.set(AUTH_NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      path: "/",
      maxAge: AUTH_NEXT_MAX_AGE,
    });
  } else {
    cookieStore.delete(AUTH_NEXT_COOKIE);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // The verifier cookie and callback must stay on the same deployment.
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    throw new Error("You could not be signed out. Please try again.");
  }

  (await cookies()).delete(AUTH_NEXT_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}
