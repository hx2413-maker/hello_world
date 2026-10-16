"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { GenerationState } from "@/lib/margins-shared";
import { generateCaption } from "./actions";
import { MemeIcon } from "./icons";

const initialState: GenerationState = { status: "idle" };
const voices = [{ value: "witty", label: "Witty" }, { value: "poetic", label: "Poetic" }, { value: "deadpan", label: "Deadpan" }] as const;

export function GenerationForm({ dailyScene, dailyLabel = "Today’s idea", initialScene = "" }: { dailyScene: string; dailyLabel?: string; initialScene?: string }) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [scene, setScene] = useState(initialScene);
  const [vibe, setVibe] = useState("witty");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef("");
  const [state, formAction, pending] = useActionState(async (previous: GenerationState, formData: FormData) => {
    // Retain the selected file across a recoverable action error and React's
    // native form reset; the same preview still represents the next submission.
    if (mode === "image" && selectedImage) formData.set("image", selectedImage);
    else formData.delete("image");
    return generateCaption(previous, formData);
  }, initialState);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  function clearImage(resetInput = true) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setPreviewUrl("");
    setSelectedImage(null);
    setImageError("");
    if (resetInput && fileInput.current) fileInput.current.value = "";
  }

  function chooseImage(file: File | undefined) {
    clearImage(false);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setImageError("Choose a JPEG, PNG, WebP, or GIF.");
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setImageError("Choose a nonempty image no larger than 2 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreviewUrl(url);
    setSelectedImage(file);
  }

  return (
    <form action={formAction} onSubmit={(event) => { if (imageError || (mode === "image" && !selectedImage)) { event.preventDefault(); setImageError("Choose an image or GIF before generating."); } }} aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-70">
        <legend className="sr-only">Create an AI meme</legend>
        <section aria-labelledby="create-daily-heading" className="rounded-xl border border-[#cbddea] bg-[#edf4fa] p-4 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#486b87]"><MemeIcon name="bolt" className="h-4 w-4" />Today’s meme idea</p>
          <h2 id="create-daily-heading" className="mt-2 text-base font-bold text-[#254965]">{dailyLabel}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{dailyScene}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-xs leading-5 text-[#486b87]">A fresh starting point every day. Make it your own.</p>
            <button type="button" onClick={() => { setMode("text"); clearImage(); setScene(dailyScene); }} className="cm-focus min-h-11 cursor-pointer rounded-lg border border-[#a8c5dd] bg-white px-3 text-xs font-bold text-[#245b89] hover:bg-[#deebf6]">Use this idea</button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Meme starting point">
          <button type="button" aria-pressed={mode === "text"} onClick={() => { setMode("text"); clearImage(); }} className={`cm-focus min-h-11 cursor-pointer rounded-md px-2 py-2.5 text-xs font-bold ${mode === "text" ? "bg-white text-[#245b89] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>Text idea</button>
          <button type="button" aria-pressed={mode === "image"} onClick={() => setMode("image")} className={`cm-focus flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-xs font-bold ${mode === "image" ? "bg-white text-[#245b89] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}><MemeIcon name="image" className="h-3.5 w-3.5" />Image or GIF</button>
        </div>

        {mode === "image" ? (
          <div>
            <label htmlFor="meme-image" className="mb-2 block text-xs font-bold text-slate-700">Upload your image or GIF</label>
            {previewUrl ? (
              <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <Image src={previewUrl} alt="Preview of your selected upload" width={500} height={400} unoptimized className="h-44 w-full object-contain" />
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2">
                  <span className="min-w-0 truncate text-xs text-slate-600">{selectedImage?.name}</span>
                  <button type="button" onClick={() => clearImage()} className="cm-focus min-h-11 shrink-0 cursor-pointer rounded px-1 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800">Remove</button>
                </div>
              </div>
            ) : (
              <label htmlFor="meme-image" className="mb-3 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[#a8c5dd] bg-[#f1f6fb] px-4 py-5 text-center hover:bg-[#e8f1f8]">
                <MemeIcon name="image" className="mb-2 h-7 w-7 text-[#5b8fb9]" />
                <span className="text-xs font-bold text-[#245b89]">Got a photo or GIF? Give it a punchline.</span>
                <span className="mt-1 text-xs text-slate-600">Choose a file below · up to 2 MB</span>
              </label>
            )}
            <input ref={fileInput} id="meme-image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required={!selectedImage} onChange={(event) => chooseImage(event.target.files?.[0])} aria-invalid={Boolean(imageError)} aria-describedby="image-help image-error" className="cm-focus block w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-[#e8f1f8] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-[#245b89]" />
            <p id="image-help" className="mt-2 text-xs leading-5 text-slate-600">JPEG, PNG, WebP, or GIF · up to 2 MB. GIFs can be up to 15 seconds and 120 frames. GIFs stay animated; AI uses a few frames to find the punchline. Use media you have permission to share.</p>
            <p id="image-error" role={imageError ? "alert" : undefined} className="mt-1 text-xs leading-5 text-rose-700">{imageError}</p>
          </div>
        ) : null}

        <div>
          <label htmlFor="scene" className="text-xs font-bold text-slate-700">{mode === "image" ? "Add context (optional)" : "What’s the situation?"}</label>
          <textarea id="scene" name="scene" required={mode === "text"} minLength={mode === "text" ? 10 : undefined} maxLength={280} rows={4} value={scene} onChange={(event) => setScene(event.target.value)} placeholder={mode === "image" ? "Anything AI should know about this image or GIF?" : "Me taking the 1 train one stop because walking counts as cardio."} aria-describedby="scene-count" className="cm-field mt-2 block resize-y px-3 py-2.5 text-base leading-6 disabled:cursor-wait sm:text-sm" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-600">{mode === "text" ? "Your own moment, or a spin on today’s idea." : "AI will use what it sees in your upload."}</span>
            <span id="scene-count" className="text-xs tabular-nums text-slate-600">{scene.length}/280{mode === "text" ? " · min. 10" : ""}</span>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2.5 text-xs font-bold text-slate-700">Choose your energy</legend>
          <div className="grid grid-cols-3 gap-2">
            {voices.map((voice) => <label key={voice.value} className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-1 py-2.5 text-xs font-semibold transition-colors ${vibe === voice.value ? "border-[#87b1d1] bg-[#edf4fa] text-[#245b89]" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}><input type="radio" name="vibe" value={voice.value} checked={vibe === voice.value} onChange={() => setVibe(voice.value)} className="cm-focus h-3 w-3 accent-[#245b89]" />{voice.label}</label>)}
          </div>
        </fieldset>

        <button type="submit" disabled={pending || Boolean(imageError)} className="cm-focus flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#245b89] px-4 py-3 text-sm font-bold text-white hover:bg-[#19456c] disabled:cursor-wait disabled:opacity-60"><MemeIcon name="sparkles" className="h-4 w-4" />{pending ? "Making your meme…" : "Generate & publish"}</button>
      </fieldset>

      <div aria-live="polite" aria-atomic="true">
        {pending ? <p className="mt-3 text-xs leading-6 text-[#245b89]" role="status">AI is finding the punchline. This can take a moment.</p> : null}
        {!pending && state.message ? <div role={state.status === "error" ? "alert" : "status"} className={`mt-3 rounded-lg border p-3 text-xs leading-6 ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}><p>{state.message}</p>{state.status === "error" && state.message.toLowerCase().includes("sign in") ? <Link href="/login?next=%2Fcreate" className="mt-1 inline-block font-bold underline underline-offset-4">Sign in again →</Link> : null}</div> : null}
      </div>

      <p className="mt-4 text-xs leading-[1.7] text-slate-600">Your image and AI caption will be public. Images and prompts are sent to Google Gemini to create the caption. Keep personal details out.</p>
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600">5 attempts per person daily. The studio has a shared daily limit of 100. Resets at midnight UTC.</p>
    </form>
  );
}
