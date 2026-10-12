import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MemberProfile } from "@/lib/profile-shared";

export const getMyProfile = cache(async (): Promise<MemberProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("member_profiles")
    .select("display_name, avatar_path, updated_at").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Your profile could not be loaded. Please try again.");
  if (!data) return null;
  let avatarUrl: string | null = null;
  if (data.avatar_path) {
    const { data: image } = await supabase.storage.from("member-avatars").createSignedUrl(data.avatar_path, 300);
    if (image?.signedUrl) avatarUrl = `${image.signedUrl}&v=${encodeURIComponent(data.updated_at)}`;
  }
  return { ...data, avatar_url: avatarUrl };
});
