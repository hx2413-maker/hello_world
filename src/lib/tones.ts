import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SharedTone } from "@/lib/tones-shared";

export const getSharedTones = cache(async (ownerId?: string): Promise<SharedTone[]> => {
  const supabase = await createClient();
  const columns = "id, user_id, name, instructions, created_at";
  const [community, own] = await Promise.all([
    supabase.from("shared_tones").select(columns)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100),
    ownerId ? supabase.from("shared_tones").select(columns).eq("user_id", ownerId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (community.error || own.error) throw new Error("Community tones could not be loaded. Please try again.");
  // Keep the owner's saved styles manageable even after newer community styles
  // move them beyond the discovery window. Overlapping rows appear only once.
  const tones = new Map<string, SharedTone>();
  for (const tone of [...(community.data ?? []), ...(own.data ?? [])] as SharedTone[]) tones.set(tone.id, tone);
  return [...tones.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
});
