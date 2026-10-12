"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeAvatar } from "@/lib/avatar-image";
import { ImageValidationError } from "@/lib/meme-image";
import { validateDisplayName, type ProfileState } from "@/lib/profile-shared";

export async function saveProfile(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Sign in before editing your profile." };

    const displayName = validateDisplayName(form.get("displayName"));
    if (!displayName) return { status: "error", message: "Choose a display name of 1–40 characters, without line breaks or hidden characters." };
    const upload = form.get("avatar");
    if (upload !== null && !(upload instanceof File)) return { status: "error", message: "Choose a valid image file." };
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    const removeAvatar = form.get("removeAvatar") === "true";
    if (file && removeAvatar) return { status: "error", message: "Choose either a new avatar or removal, then save again." };

    const { data: existing, error: readError } = await supabase.from("member_profiles")
      .select("avatar_path").eq("id", user.id).maybeSingle();
    if (readError) return { status: "error", message: "Your profile could not be loaded. Please try again." };
    let avatarPath: string | null = removeAvatar ? null : existing?.avatar_path ?? null;
    if (file) {
      let image: Buffer;
      try { image = await normalizeAvatar(file); }
      catch (error) {
        return { status: "error", message: error instanceof ImageValidationError ? error.message : "Your avatar could not be read." };
      }
      avatarPath = `${user.id}/avatar.webp`;
      const { error: uploadError } = await supabase.storage.from("member-avatars")
        .upload(avatarPath, image, { contentType: "image/webp", cacheControl: "0", upsert: true });
      if (uploadError) return { status: "error", message: "Your avatar couldn’t be uploaded. Your name has not changed; please try again." };
    }

    const values = { display_name: displayName, avatar_path: avatarPath };
    const mutation = existing
      ? supabase.from("member_profiles").update(values).eq("id", user.id)
      : supabase.from("member_profiles").insert({ id: user.id, ...values });
    const { data: profile, error: saveError } = await mutation.select("display_name, avatar_path, updated_at").single();
    if (saveError || !profile) return { status: "error", message: "We couldn’t confirm your profile was saved. Refresh to check it before trying again." };

    let avatarUrl: string | null = null;
    if (profile.avatar_path) {
      const { data: image } = await supabase.storage.from("member-avatars").createSignedUrl(profile.avatar_path, 300);
      if (image?.signedUrl) avatarUrl = `${image.signedUrl}&v=${encodeURIComponent(profile.updated_at)}`;
    }
    // Removing the reference immediately hides the avatar. Keep the old storage
    // object private until a later upload overwrites it; at most one per account.
    revalidatePath("/", "layout");
    return { status: "success", message: "Profile saved. Your name and avatar are updated on your memes.", profile: { ...profile, avatar_url: avatarUrl } };
  } catch {
    return { status: "error", message: "Your profile couldn’t be saved. Please try again shortly." };
  }
}
