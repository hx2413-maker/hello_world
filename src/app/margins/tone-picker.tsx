"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BUILT_IN_TONES, type SharedTone, type ToneState } from "@/lib/tones-shared";
import { deleteTone, saveTone } from "./tone-actions";

export function TonePicker({ tones, userId, initialToneId, initialTone }: { tones: SharedTone[]; userId?: string; initialToneId?: string; initialTone?: string }) {
  const [sharedTones, setSharedTones] = useState(tones);
  const [selection, setSelection] = useState(tones.some((tone) => tone.id === initialToneId) ? `shared:${initialToneId}` : BUILT_IN_TONES.find((tone) => tone.name === initialTone)?.name ?? "witty");
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [feedback, setFeedback] = useState<ToneState>({ status: "idle" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const selectedTone = sharedTones.find((tone) => selection === `shared:${tone.id}`);

  function select(value: string) {
    setSelection(value);
    setConfirmDelete(false);
    setFeedback({ status: "idle" });
  }

  function save() {
    const form = new FormData();
    form.set("toneName", name);
    form.set("toneInstructions", instructions);
    startTransition(async () => {
      const result = await saveTone(form);
      setFeedback(result);
      if (result.tone) {
        setSharedTones((current) => [result.tone!, ...current]);
        setSelection(`shared:${result.tone.id}`);
      }
    });
  }

  function remove() {
    if (!selectedTone) return;
    startTransition(async () => {
      const result = await deleteTone(selectedTone.id);
      setFeedback(result);
      if (result.status === "success") {
        setSharedTones((current) => current.filter((tone) => tone.id !== selectedTone.id));
        setSelection("witty");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <fieldset disabled={pending} className="space-y-3 disabled:opacity-70">
      <legend className="mb-2.5 text-sm font-bold text-slate-800">Choose your tone</legend>
      <input type="hidden" name="vibe" value={selection.startsWith("shared:") ? "shared" : selection} />
      {selectedTone ? <input type="hidden" name="toneId" value={selectedTone.id} /> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[...BUILT_IN_TONES.map((tone) => ({ value: tone.name, label: tone.label })), { value: "custom", label: "Make your own" }].map((tone) => (
          <label key={tone.value} className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-semibold ${selection === tone.value ? "border-[#87b1d1] bg-[#edf4fa] text-[#245b89]" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
            <input type="radio" name="tone-choice" value={tone.value} checked={selection === tone.value} onChange={() => select(tone.value)} className="cm-focus h-3 w-3 accent-[#245b89]" />{tone.label}
          </label>
        ))}
      </div>
      <div>
        <label htmlFor="community-tone" className="text-xs font-semibold text-slate-700">Or borrow a community tone</label>
        <select id="community-tone" value={selectedTone?.id ?? ""} onChange={(event) => select(event.target.value ? `shared:${event.target.value}` : "witty")} className="cm-field mt-2 min-h-11 px-3 py-2 text-sm">
          <option value="">{sharedTones.length ? "Choose a shared tone…" : "No shared tones yet — make the first one"}</option>
          {sharedTones.map((tone) => <option key={tone.id} value={tone.id}>{tone.name}{tone.user_id === userId ? " · Yours" : " · Community"}</option>)}
        </select>
      </div>
      {selectedTone ? (
        <div className="rounded-xl border border-[#cbddea] bg-[#f4f8fc] p-4">
          <p className="text-sm font-bold text-[#254965]">{selectedTone.name}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{selectedTone.instructions}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <Link href={`/members/${selectedTone.user_id}`} className="cm-focus rounded font-semibold text-[#245b89] underline underline-offset-4">{selectedTone.user_id === userId ? "Shared by you" : "Meet the creator"}</Link>
            {selectedTone.user_id === userId ? (
              confirmDelete ? <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={remove} className="cm-focus min-h-11 cursor-pointer rounded font-semibold text-rose-700">Remove shared tone</button><button type="button" onClick={() => setConfirmDelete(false)} className="cm-focus min-h-11 cursor-pointer rounded text-slate-600">Keep it</button></div>
                : <button type="button" onClick={() => setConfirmDelete(true)} className="cm-focus min-h-11 cursor-pointer rounded text-slate-500 hover:text-rose-700">Remove tone</button>
            ) : null}
          </div>
        </div>
      ) : null}
      {selection === "custom" ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div><label htmlFor="tone-name" className="text-xs font-bold text-slate-700">Name your tone</label><input id="tone-name" name="toneName" required minLength={2} maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder="Overcaffeinated TA" className="cm-field mt-1 min-h-11 px-3 py-2 text-sm" /></div>
          <div><label htmlFor="tone-instructions" className="text-xs font-bold text-slate-700">How should it sound?</label><textarea id="tone-instructions" name="toneInstructions" required minLength={10} maxLength={400} rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Earnest academic language, escalating panic, and a very dry punchline." className="cm-field mt-1 resize-y px-3 py-2 text-sm" /><p className="mt-1 text-right text-xs text-slate-500">{instructions.length}/400</p></div>
          <p className="text-xs leading-5 text-slate-600">Generate with this tone now, or save it so everyone can reuse it. Saving makes its name and description public.</p>
          <button type="button" onClick={save} className="cm-focus min-h-11 cursor-pointer rounded-lg border border-[#a8c5dd] bg-white px-4 text-xs font-bold text-[#245b89] hover:bg-[#deebf6]">Save & share tone</button>
        </div>
      ) : null}
      {pending ? <p role="status" className="text-xs text-[#245b89]">Saving your change…</p> : null}
      {!pending && feedback.message ? <p role={feedback.status === "error" ? "alert" : "status"} className={`text-xs leading-5 ${feedback.status === "error" ? "text-rose-700" : "text-[#245b89]"}`}>{feedback.message}</p> : null}
    </fieldset>
  );
}
