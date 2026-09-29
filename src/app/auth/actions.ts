"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthOrigin } from "@/lib/auth-origin";

export async function signInWithGoogle() {
  const origin = getAuthOrigin(await headers(), { verifyRequestOrigin: true });
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

  revalidatePath("/", "layout");
  redirect("/login");
}
