"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/margins-shared";
import { validateTone, type SharedTone, type ToneState } from "@/lib/tones-shared";

export async function saveTone(form: FormData): Promise<ToneState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.is_anonymous) return { status: "error", message: "Sign in to save a shared tone." };
    const tone = validateTone(form.get("toneName"), form.get("toneInstructions"));
    if (!tone) return { status: "error", message: "Give your tone a 2–40 character name and describe its style in 10–400 characters." };
    const { data, error } = await supabase.from("shared_tones").insert({ user_id: user.id, ...tone })
      .select("id, user_id, name, instructions, created_at").single();
    if (error) return { status: "error", message: error.code === "23505" ? "You already saved a tone with that name. Choose it from community tones or use another name." : error.message === "Shared tone limit reached." ? "You can share up to 20 tones. Remove one of yours before saving another." : "Your tone couldn’t be saved. Please try again." };
    revalidatePath("/create");
    return { status: "success", message: "Tone saved. Everyone can now use it.", tone: data as SharedTone };
  } catch {
    return { status: "error", message: "Your tone couldn’t be saved. Please try again." };
  }
}

export async function deleteTone(id: string): Promise<ToneState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.is_anonymous) return { status: "error", message: "Sign in to remove your tone." };
    if (!isUuid(id)) return { status: "error", message: "Choose one of your saved tones." };
    const { data, error } = await supabase.from("shared_tones").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) return { status: "error", message: "This tone couldn’t be removed. You can only remove your own tones." };
    revalidatePath("/create");
    return { status: "success", message: "Tone removed. Existing memes keep their original tone." };
  } catch {
    return { status: "error", message: "Your tone couldn’t be removed. Please try again." };
  }
}
