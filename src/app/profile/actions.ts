"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_NEXT_COOKIE, getSafeAuthNext } from "@/lib/auth-next";
import type { ProfileFormState } from "./types";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_BUCKET = "profile-photos";

function photoFormat(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSignature.every((byte, index) => bytes[index] === byte)) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

async function removePhoto(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  try {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    if (error) console.error("Unable to remove an unused profile photo.");
  } catch {
    console.error("Unable to remove an unused profile photo.");
  }
}

async function removeUnreferencedPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  path: string,
) {
  try {
    // A lost response can happen after a successful database write. Only
    // discard the upload when another read confirms it is not in use.
    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", userId)
      .maybeSingle();
    if (!error && data?.avatar_path !== path) await removePhoto(supabase, path);
  } catch {
    console.error("Unable to confirm whether a profile photo can be removed.");
  }
}

export async function saveProfile(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  let state: ProfileFormState;
  try {
    state = await persistProfile(formData);
  } catch {
    return { status: "error", message: "We couldn’t confirm your changes. Refresh the page before trying again." };
  }
  if (state.status === "success") {
    const cookieStore = await cookies();
    const next = getSafeAuthNext(formData.get("next")) ?? getSafeAuthNext(cookieStore.get(AUTH_NEXT_COOKIE)?.value);
    cookieStore.delete(AUTH_NEXT_COOKIE);
    // Successful persistence guarantees both required names were saved. Keep
    // redirects outside the catch so Next.js can finish the navigation.
    if (next) redirect(next);
  }
  return state;
}

async function persistProfile(formData: FormData): Promise<ProfileFormState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "Your session has expired. Please sign in again before saving." };
  }

  const firstNameValue = formData.get("firstName");
  const lastNameValue = formData.get("lastName");
  const firstName = typeof firstNameValue === "string" ? firstNameValue.trim() : "";
  const lastName = typeof lastNameValue === "string" ? lastNameValue.trim() : "";
  const fieldErrors: NonNullable<ProfileFormState["fieldErrors"]> = {};

  if (!firstName || firstName.length > 100) {
    fieldErrors.firstName = "Enter a first name between 1 and 100 characters.";
  }
  if (!lastName || lastName.length > 100) {
    fieldErrors.lastName = "Enter a last name between 1 and 100 characters.";
  }

  const photo = formData.get("photo");
  // Browsers/React may submit an empty File with a placeholder filename even
  // when nothing was selected. Only bytes indicate a new optional upload.
  const hasPhoto = photo instanceof File && photo.size > 0;
  const removeCurrentPhoto = formData.get("removePhoto") === "on";
  let photoBytes: Uint8Array | null = null;
  let format: ReturnType<typeof photoFormat> = null;

  if (photo !== null && !(photo instanceof File)) {
    fieldErrors.photo = "Choose a JPEG, PNG, or WebP image.";
  } else if (hasPhoto) {
    if (photo.size > MAX_PHOTO_BYTES) {
      fieldErrors.photo = "Choose a nonempty image no larger than 2 MB.";
    } else {
      photoBytes = new Uint8Array(await photo.arrayBuffer());
      format = photoFormat(photoBytes);
      if (!format || photo.type !== format.contentType) {
        fieldErrors.photo = "Choose a valid JPEG, PNG, or WebP image.";
      }
    }
  }

  if (hasPhoto && removeCurrentPhoto) {
    fieldErrors.photo = "Choose either a new photo or removal of your current photo, then save again.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: hasPhoto ? "Please check the highlighted fields and select your photo again." : "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  // Derive ownership from the verified session, never from submitted form data.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { status: "error", message: "Your profile is temporarily unavailable. Refresh the page and try again." };
  }

  let uploadedPath: string | null = null;
  if (photoBytes && format) {
    uploadedPath = `${user.id}/${randomUUID()}.${format.extension}`;
    let uploadSucceeded = false;
    try {
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(uploadedPath, photoBytes, {
          contentType: format.contentType,
          cacheControl: "3600",
          upsert: false,
        });
      uploadSucceeded = !uploadError;
    } catch {
      // A connection failure is handled like an unsuccessful upload below.
    }

    if (!uploadSucceeded) {
      await removePhoto(supabase, uploadedPath);
      return { status: "error", message: "Your photo could not be uploaded. Please choose it again and retry; your profile has not changed." };
    }
  }

  let saved = false;
  try {
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        ...(uploadedPath ? { avatar_path: uploadedPath } : removeCurrentPhoto ? { avatar_path: null } : {}),
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    saved = !updateError && Boolean(updatedProfile);
  } catch {
    if (uploadedPath) await removeUnreferencedPhoto(supabase, user.id, uploadedPath);
    return { status: "error", message: "We couldn’t confirm your changes. Refresh the page before trying again." };
  }

  if (!saved) {
    if (uploadedPath) {
      await removeUnreferencedPhoto(supabase, user.id, uploadedPath);
    }
    return { status: "error", message: "Your changes could not be saved. Please try again and reselect your photo if you added one." };
  }

  if (
    (uploadedPath || removeCurrentPhoto) &&
    typeof profile.avatar_path === "string" &&
    profile.avatar_path.startsWith(`${user.id}/`) &&
    profile.avatar_path !== uploadedPath
  ) {
    await removePhoto(supabase, profile.avatar_path);
  }

  revalidatePath("/profile");
  revalidatePath("/members");
  revalidatePath("/", "layout");
  return { status: "success", message: "Your profile is saved. You’re ready for the members’ reading room." };
}
