"use client";

import { useState } from "react";

export function ShareLink({ captionId }: { captionId: string }) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState("");

  async function copyLink() {
    const url = new URL(`/margins/${captionId}`, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFallbackUrl("");
    } catch {
      setFallbackUrl(url);
    }
  }

  return (
    <div className="max-w-full text-right">
      <button type="button" onClick={copyLink} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-2 text-xs font-medium text-slate-400 transition-colors hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4"><path d="m8 12 4-4m-5.5 6.5-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m1-1 1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" transform="translate(1.25 -1.25)" strokeLinecap="round" /></svg>
        {copied ? "Link copied" : "Copy link"}
      </button>
      <span aria-live="polite" className="sr-only">{copied ? "Caption link copied to clipboard." : ""}</span>
      {fallbackUrl ? (
        <label className="mt-2 block text-left text-xs text-slate-300">
          Copy this link to share
          <input readOnly value={fallbackUrl} onFocus={(event) => event.target.select()} className="mt-2 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 p-2 text-xs text-sky-200 focus-visible:outline-2 focus-visible:outline-sky-300" />
        </label>
      ) : null}
    </div>
  );
}
