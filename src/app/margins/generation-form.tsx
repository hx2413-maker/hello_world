"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { GenerationState } from "@/lib/margins-shared";
import { generateCaption } from "./actions";

const initialState: GenerationState = { status: "idle" };
const vibes = [
  { value: "witty", label: "Witty", hint: "A little too online" },
  { value: "poetic", label: "Poetic", hint: "Main-character energy" },
  { value: "deadpan", label: "Deadpan", hint: "Said with a straight face" },
] as const;

export function GenerationForm({ dailyScene }: { dailyScene: string }) {
  const [state, formAction, pending] = useActionState(generateCaption, initialState);
  const [scene, setScene] = useState("");
  const [vibe, setVibe] = useState("witty");

  return (
    <form action={formAction} aria-busy={pending} className="mt-7">
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-70">
        <legend className="sr-only">Generate a city caption</legend>
        <div>
          <label htmlFor="scene" className="text-sm font-semibold text-slate-100">Set the scene</label>
          <p id="scene-help" className="mt-2 text-xs leading-5 text-slate-400">A tiny city moment is plenty. Skip names and personal details.</p>
          <textarea
            id="scene"
            name="scene"
            required
            minLength={10}
            maxLength={280}
            rows={5}
            value={scene}
            onChange={(event) => setScene(event.target.value)}
            placeholder="Missed the 1 train, found a very good bagel. Calling it a plot twist."
            aria-describedby="scene-help scene-count"
            className="mt-3 block w-full resize-y rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-500 focus:border-sky-300 focus:outline-2 focus:outline-offset-2 focus:outline-sky-300 disabled:cursor-wait"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setScene(dailyScene)} className="rounded text-xs font-medium text-sky-300 underline decoration-sky-300/40 underline-offset-4 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Use today’s prompt</button>
            <span id="scene-count" className="font-mono text-[11px] text-slate-400">{scene.length}/280 · min. 10</span>
          </div>
        </div>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-100">Pick a voice</legend>
          <div className="space-y-2">
            {vibes.map((option) => (
              <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${vibe === option.value ? "border-sky-300/60 bg-sky-300/10" : "border-slate-700/80 hover:border-slate-500"}`}>
                <input type="radio" name="vibe" value={option.value} checked={vibe === option.value} onChange={() => setVibe(option.value)} className="h-4 w-4 accent-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300" />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-slate-100">{option.label}</span>
                  <span className="text-[11px] text-slate-400">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={pending} className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-sky-300 px-5 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 disabled:cursor-wait disabled:opacity-70">
          {pending ? "Writing your caption…" : "Generate & publish"}
          {!pending ? <span aria-hidden="true">↗</span> : null}
        </button>
      </fieldset>

      <div aria-live="polite" aria-atomic="true">
        {pending ? <p className="mt-4 text-sm leading-6 text-sky-200" role="status">Finding the words. This can take a few moments.</p> : null}
        {!pending && state.message ? (
          <div role={state.status === "error" ? "alert" : "status"} className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${state.status === "error" ? "border-rose-300/30 bg-rose-300/5 text-rose-200" : "border-sky-300/30 bg-sky-300/5 text-sky-200"}`}>
            <p>{state.message}</p>
            {state.status === "error" && state.message.toLowerCase().includes("sign in") ? <Link href="/login?next=%2Fmargins" className="mt-2 inline-block underline underline-offset-4">Sign in again →</Link> : null}
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-400">Your AI caption and its voice will be public. Your saved prompts are only visible to you, but details may appear in the caption.</p>
      <p className="mt-3 border-t border-slate-700/70 pt-3 text-[11px] leading-5 text-slate-400">Up to 5 attempts per person and 100 across the studio each day. Resets at midnight UTC. AI can get things wrong; these are creative captions, not city advice.</p>
    </form>
  );
}
