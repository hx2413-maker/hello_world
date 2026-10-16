"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid, type DeleteMemeState } from "@/lib/margins-shared";

export async function deleteMeme(_previous: DeleteMemeState, form: FormData): Promise<DeleteMemeState> {
  let ownerId: string;
  let captionId: string;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Sign in before deleting a meme." };
    const id = form.get("captionId");
    if (!isUuid(id)) return { status: "error", message: "Choose a valid meme to delete." };
    // Check ownership here and again through the DELETE policy. Never trust an
    // owner ID or the visibility of a button supplied by the browser.
    const { data: request, error: requestError } = await supabase.from("generation_requests")
      .select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (requestError || !request) return { status: "error", message: "You can only delete your own published memes." };
    const { data: removed, error } = await supabase.from("captions")
      .delete().eq("id", id).eq("is_starter", false).select("id, image_path").maybeSingle();
    if (error) return { status: "error", message: "Your meme couldn’t be deleted. Please try again." };
    if (!removed) return { status: "error", message: "This meme is already gone or isn’t yours to delete." };

    // The public caption and votes are deleted atomically in Postgres. Storage
    // cleanup is best effort: RLS already prevents new public image URLs after
    // removal, and the private request remains to preserve generation quotas.
    if (removed.image_path) {
      await supabase.storage.from("meme-images").remove([removed.image_path]).catch(() => undefined);
    }
    ownerId = user.id;
    captionId = id;
  } catch {
    return { status: "error", message: "We couldn’t confirm the deletion. Refresh your profile before trying again." };
  }
  revalidatePath("/margins");
  revalidatePath(`/margins/${captionId}`);
  revalidatePath(`/members/${ownerId}`);
  redirect(`/members/${ownerId}?deleted=1`);
}
