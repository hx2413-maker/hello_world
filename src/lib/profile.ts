import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MemberProfile, PublicMember } from "@/lib/profile-shared";
import { isUuid } from "@/lib/margins-shared";

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

export const getPublicMember = cache(async (userId: string): Promise<PublicMember | null> => {
  if (!isUuid(userId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_member", { p_user_id: userId }).maybeSingle();
  if (error) throw new Error("This profile could not be loaded. Please try again.");
  if (!data) return null;
  const member = data as Omit<PublicMember, "avatar_url">;
  let avatarUrl: string | null = null;
  if (member.avatar_path) {
    const { data: image } = await supabase.storage.from("member-avatars").createSignedUrl(member.avatar_path, 300);
    if (image?.signedUrl) avatarUrl = `${image.signedUrl}&v=${encodeURIComponent(member.updated_at ?? "")}`;
  }
  return { ...member, avatar_url: avatarUrl };
});
