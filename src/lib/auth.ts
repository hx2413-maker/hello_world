import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  return error ? null : data.user;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_path")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (error) {
    throw new Error("Your profile could not be loaded. Please try again.");
  }

  return data;
});

export function isProfileComplete(profile: Profile | null): boolean {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}
