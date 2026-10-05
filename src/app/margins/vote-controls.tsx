"use client";

import { useActionState } from "react";
import type { VoteState } from "@/lib/margins-shared";
import { voteCaption } from "./actions";

const initialState: VoteState = { status: "idle" };

export function VoteControls({ captionId, viewerVote, upvotes, downvotes }: {
  captionId: string;
  viewerVote: number | null;
  upvotes: number;
  downvotes: number;
}) {
  const [state, formAction, pending] = useActionState(voteCaption, initialState);

  return (
    <div>
      <form action={formAction} aria-busy={pending} className="flex flex-wrap items-center gap-2" aria-label="Rate this caption">
        <input type="hidden" name="captionId" value={captionId} />
        <button
          type="submit"
          name="value"
          value={viewerVote === 1 ? "0" : "1"}
          aria-pressed={viewerVote === 1}
          aria-label={viewerVote === 1 ? `Remove upvote. ${upvotes} upvotes` : `Upvote. ${upvotes} upvotes`}
          disabled={pending}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 disabled:cursor-wait disabled:opacity-60 ${viewerVote === 1 ? "border-sky-300/60 bg-sky-300/15 text-sky-200" : "border-slate-700 text-slate-300 hover:border-sky-300/50 hover:text-sky-200"}`}
        >
          <span aria-hidden="true" className="text-lg">↑</span>
          <span className="font-mono text-xs tabular-nums">{upvotes}</span>
        </button>
        <button
          type="submit"
          name="value"
          value={viewerVote === -1 ? "0" : "-1"}
          aria-pressed={viewerVote === -1}
          aria-label={viewerVote === -1 ? `Remove downvote. ${downvotes} downvotes` : `Downvote. ${downvotes} downvotes`}
          disabled={pending}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 disabled:cursor-wait disabled:opacity-60 ${viewerVote === -1 ? "border-rose-300/60 bg-rose-300/10 text-rose-200" : "border-slate-700 text-slate-300 hover:border-rose-300/50 hover:text-rose-200"}`}
        >
          <span aria-hidden="true" className="text-lg">↓</span>
          <span className="font-mono text-xs tabular-nums">{downvotes}</span>
        </button>
        {pending ? <span role="status" className="text-xs text-slate-400">Saving…</span> : null}
      </form>
      <div aria-live="polite" aria-atomic="true">
        {!pending && state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`mt-2 max-w-sm text-xs leading-5 ${state.status === "error" ? "text-rose-200" : "text-sky-200"}`}>{state.message}</p> : null}
      </div>
    </div>
  );
}
