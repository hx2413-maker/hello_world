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
  return (data ?? []) as Caption[];
}

export async function getGenerationForCaption(id: string): Promise<GenerationRequest | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // Caption and request IDs are identical; RLS exposes only this user's request.
  const { data, error } = await supabase.from("generation_requests")
    .select("id, scene, vibe, prompt, system_prompt, model, status, created_at")
    .eq("id", id).eq("user_id", user.id).maybeSingle<GenerationRequest>();
  if (error) throw new Error("Your saved prompt could not be loaded.");
  return data;
}
