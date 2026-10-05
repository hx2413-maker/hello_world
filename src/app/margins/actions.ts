"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createGenerationWriter } from "@/lib/supabase/generation-writer";
import { generateWithGemini, getGenerationConfig } from "@/lib/gemini";
import { buildPrompt, SYSTEM_PROMPT } from "@/lib/generation-contract";
import { isUuid, isVibe, validateScene, type GenerationState, type VoteState } from "@/lib/margins-shared";

export async function generateCaption(_previousState: GenerationState, form: FormData): Promise<GenerationState> {
  let captionId: string;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Sign in before generating a caption." };
    const scene = validateScene(form.get("scene"));
    const vibe = form.get("vibe");
    if (!scene || !isVibe(vibe)) return { status: "error", message: "Describe your scene in 10–280 characters and choose a tone." };

    const config = getGenerationConfig();
    const writer = createGenerationWriter();
    if (!config || !writer) return { status: "error", message: "The caption studio is temporarily unavailable. You can still explore and vote on published captions." };
    const prompt = buildPrompt(scene, vibe);
    const { data: requestId, error: reserveError } = await supabase.rpc("reserve_generation", {
      p_scene: scene, p_vibe: vibe, p_prompt: prompt, p_system_prompt: SYSTEM_PROMPT, p_model: config.model,
    });
    if (reserveError || !isUuid(requestId)) {
      const quotaMessage = reserveError?.message === "Daily generation limit reached."
        ? "You’ve used today’s five generation attempts. Come back after midnight UTC for a fresh set."
        : reserveError?.message === "Daily studio limit reached."
          ? "The studio has reached today’s shared limit. Come back after midnight UTC; you can still explore and vote."
          : "We couldn’t start your caption. Please try again in a moment.";
      return { status: "error", message: quotaMessage };
    }

    let output: Awaited<ReturnType<typeof generateWithGemini>>;
    try {
      output = await generateWithGemini(prompt, config);
    } catch {
      await writer.fail(requestId).catch(() => undefined);
      return { status: "error", message: "The AI couldn’t finish this caption. Try a different scene or try again later. This attempt counts toward today’s limit." };
    }

    // Completion is idempotent. Retry a lost response without generating again.
    let savedId: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await writer.complete(requestId, output.body, output.inputTokens, output.outputTokens);
        if (!error && isUuid(data)) { savedId = data; break; }
      } catch { /* A second completion recovers an interrupted database response. */ }
    }
    if (!isUuid(savedId)) {
      // Do not mark a possibly committed write as failed or call the model again.
      return { status: "error", message: "We couldn’t confirm your caption was saved. Check the newest captions before trying again." };
    }
    captionId = savedId;
  } catch {
    return { status: "error", message: "The studio could not be reached. Please try again shortly." };
  }
  revalidatePath("/margins");
  redirect(`/margins/${captionId}`);
}

export async function voteCaption(_previousState: VoteState, form: FormData): Promise<VoteState> {
  let captionId: string;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Sign in before voting." };
    const id = form.get("captionId");
    const value = form.get("value");
    if (!isUuid(id) || (value !== "1" && value !== "-1" && value !== "0")) {
      return { status: "error", message: "Choose an upvote or downvote on an existing caption." };
    }
    const { error } = await supabase.rpc("cast_vote", { p_caption_id: id, p_value: Number(value) });
    if (error) return { status: "error", message: "Your vote couldn’t be saved. Please refresh and try again." };
    captionId = id;
  } catch {
    return { status: "error", message: "Your vote couldn’t be saved. Please try again." };
  }
  revalidatePath("/margins");
  revalidatePath(`/margins/${captionId}`);
  return { status: "success", message: "Vote saved." };
}
