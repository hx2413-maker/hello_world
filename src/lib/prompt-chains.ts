import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const PROMPT_CHAINS_URL = process.env.NEXT_PUBLIC_PROMPT_CHAINS_URL || "https://campus-prompt-chains.vercel.app";

/** Navigation eligibility only. The studio independently authorizes every request. */
export const canOpenPromptChains = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.from("member_profiles")
    .select("is_superadmin, is_blocked, deleted_at").eq("id", user.id).maybeSingle();
  return !error && data?.is_superadmin === true && data.is_blocked === false && data.deleted_at == null;
});
