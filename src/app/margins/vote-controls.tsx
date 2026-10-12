"use client";

import { useActionState } from "react";
import type { VoteState } from "@/lib/margins-shared";
import { voteCaption } from "./actions";
import { MemeIcon } from "./icons";

const initialState: VoteState = { status: "idle" };

export function VoteControls({ captionId, viewerVote, upvotes, downvotes }: { captionId: string; viewerVote: number | null; upvotes: number; downvotes: number }) {
  const [state, formAction, pending] = useActionState(voteCaption, initialState);
  return (
    <div>
      <form action={formAction} aria-busy={pending} aria-label="Rate this meme" className="flex items-center gap-2">
        <input type="hidden" name="captionId" value={captionId} />
        <button type="submit" name="value" value={viewerVote === 1 ? "0" : "1"} aria-pressed={viewerVote === 1} aria-label={viewerVote === 1 ? `Remove upvote. ${upvotes} upvotes` : `Upvote. ${upvotes} upvotes`} disabled={pending} className={`cm-focus flex min-h-11 min-w-[76px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${viewerVote === 1 ? "border-[#90b6d4] bg-[#e5eff8] text-[#245b89]" : "border-slate-200 bg-white text-slate-600 hover:border-[#90b6d4] hover:bg-[#f3f7fb]"}`}><MemeIcon name="up" className="h-5 w-5" /><span className="tabular-nums">{upvotes}</span></button>
        <button type="submit" name="value" value={viewerVote === -1 ? "0" : "-1"} aria-pressed={viewerVote === -1} aria-label={viewerVote === -1 ? `Remove downvote. ${downvotes} downvotes` : `Downvote. ${downvotes} downvotes`} disabled={pending} className={`cm-focus flex min-h-11 min-w-[76px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${viewerVote === -1 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"}`}><MemeIcon name="down" className="h-5 w-5" /><span className="tabular-nums">{downvotes}</span></button>
        {pending ? <span role="status" className="text-[11px] text-slate-500">Saving…</span> : null}
      </form>
      <div aria-live="polite" aria-atomic="true">{!pending && state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`mt-2 max-w-xs text-[11px] leading-5 ${state.status === "error" ? "text-rose-700" : "text-[#245b89]"}`}>{state.message}</p> : null}</div>
    </div>
  );
}
