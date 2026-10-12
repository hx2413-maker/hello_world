import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid, type Caption, type GenerationRequest } from "@/lib/margins-shared";

export async function getCaptionFeed(sort: "new" | "top", offset = 0, captionId?: string): Promise<Caption[]> {
  if (captionId && !isUuid(captionId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_caption_feed", {
    p_sort: sort, p_limit: 12, p_offset: offset, p_caption_id: captionId ?? null,
  });
  if (error) throw new Error("The captions could not be loaded. Please try again.");
  const captions = (data ?? []) as Omit<Caption, "image_url" | "author_avatar_url">[];
  const paths = [...new Set(captions.flatMap((caption) => caption.image_path ? [caption.image_path] : []))];
  const signedUrls = new Map<string, string>();
  if (paths.length) {
    // Storage RLS allows signing only images that have been published in the feed.
    const { data: images, error: imageError } = await supabase.storage.from("meme-images").createSignedUrls(paths, 3600);
    if (imageError) throw new Error("Meme images could not be loaded. Please try again.");
    for (const image of images ?? []) if (image.path && image.signedUrl) signedUrls.set(image.path, image.signedUrl);
  }
  const avatarPaths = [...new Set(captions.flatMap((caption) => caption.author_avatar_path ? [caption.author_avatar_path] : []))];
  const avatars = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: images } = await supabase.storage.from("member-avatars").createSignedUrls(avatarPaths, 300);
    for (const image of images ?? []) if (image.path && image.signedUrl) avatars.set(image.path, image.signedUrl);
  }
  return captions.map((caption) => {
    const avatar = caption.author_avatar_path ? avatars.get(caption.author_avatar_path) : null;
    return { ...caption, image_path: caption.image_path ?? null, image_url: caption.image_path ? signedUrls.get(caption.image_path) ?? null : null,
      author_name: caption.author_name ?? null, author_avatar_path: caption.author_avatar_path ?? null,
      author_updated_at: caption.author_updated_at ?? null,
      author_avatar_url: avatar ? `${avatar}&v=${encodeURIComponent(caption.author_updated_at ?? "")}` : null };
  });
}

export async function getGenerationForCaption(id: string): Promise<GenerationRequest | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // Caption and request IDs are identical; RLS exposes only this user's request.
  const { data, error } = await supabase.from("generation_requests")
    .select("id, scene, vibe, prompt, system_prompt, model, status, created_at, image_path")
    .eq("id", id).eq("user_id", user.id).maybeSingle<GenerationRequest>();
  if (error) throw new Error("Your saved prompt could not be loaded.");
  return data;
}
