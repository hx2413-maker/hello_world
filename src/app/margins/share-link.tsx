"use client";

import { useState } from "react";
import { MemeIcon } from "./icons";

export function ShareLink({ captionId }: { captionId: string }) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState("");
  async function copyLink() {
    const url = new URL(`/margins/${captionId}`, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setCopied(true); setFallbackUrl(""); }
    catch { setFallbackUrl(url); }
  }
  return (
    <div className="max-w-full text-right">
      <button type="button" onClick={copyLink} className="cm-focus inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"><MemeIcon name="link" className="h-4 w-4" />{copied ? "Copied!" : "Share"}</button>
      <span aria-live="polite" className="sr-only">{copied ? "Meme link copied to clipboard." : ""}</span>
      {fallbackUrl ? <label className="mt-2 block text-left text-[11px] text-slate-500">Copy this link to share<input readOnly value={fallbackUrl} onFocus={(event) => event.target.select()} className="cm-field mt-1 block max-w-full p-2 text-xs" /></label> : null}
    </div>
  );
}
