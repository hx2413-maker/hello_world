"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MemeTemplate } from "@/lib/content-sources";

function TemplateCard({ template }: { template: MemeTemplate }) {
  const [failed, setFailed] = useState(false);
  return (
    <li>
      <Link href={`/create?template=${template.id}`} className="cm-focus group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-[#8db4d3]">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#e8edf2] p-3">
          {failed ? <span className="px-5 text-center text-sm text-slate-500">Preview unavailable. Select to try this template.</span> : (
            <Image src={template.url} alt={template.name} width={template.width} height={template.height} unoptimized referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setFailed(true)} />
          )}
        </div>
        <div className="flex min-h-20 items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-sm font-bold leading-5 text-slate-900">{template.name}</h2>
          <span aria-hidden="true" className="shrink-0 rounded-full bg-[#edf4fa] px-3 py-2 text-[#245b89] group-hover:bg-[#dcebf6]">→</span>
        </div>
      </Link>
    </li>
  );
}

export function TemplateGallery({ templates }: { templates: MemeTemplate[] }) {
  const [query, setQuery] = useState("");
  const filtered = templates.filter((template) => template.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-md">
          <label htmlFor="template-search" className="mb-2 block text-sm font-semibold text-slate-700">Search the library</label>
          <input id="template-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Drake, two buttons, or distracted…" maxLength={100} className="cm-focus min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500" />
        </div>
        <p role="status" aria-live="polite" className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? "template" : "templates"}</p>
      </div>
      {filtered.length ? <ul className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((template) => <TemplateCard key={template.id} template={template} />)}</ul> : (
        <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center">
          <p className="font-semibold text-slate-700">No matching templates.</p>
          <p className="mt-2 text-sm text-slate-500">Try a shorter name, or start with your own image.</p>
          <button type="button" onClick={() => setQuery("")} className="cm-focus mt-4 min-h-11 rounded-lg px-4 text-sm font-bold text-[#245b89] hover:bg-[#eaf3f9]">Clear search</button>
        </div>
      )}
    </>
  );
}
