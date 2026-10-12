"use client";

import Image from "next/image";
import { useState } from "react";

export function Avatar({ src, name, size = 36, alt = "" }: { src?: string | null; name?: string | null; size?: number; alt?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = words.length ? [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])].map((word) => Array.from(word)[0]).join("").toUpperCase() : "";

  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5eff7] font-bold text-[#245b89] ring-1 ring-inset ring-[#cfdfed]" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {src && src !== failedSource ? (
        <Image src={src} alt={alt} width={size} height={size} unoptimized onError={() => setFailedSource(src)} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden={alt ? undefined : true} role={alt ? "img" : undefined} aria-label={alt || undefined} className="flex h-full w-full items-center justify-center">
          {initials || <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-1/2 w-1/2"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>}
        </span>
      )}
    </span>
  );
}
