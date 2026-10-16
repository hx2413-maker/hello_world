"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { deleteMeme } from "./delete-actions";
import type { DeleteMemeState } from "@/lib/margins-shared";

const initialState: DeleteMemeState = { status: "idle" };

export function DeleteMemeButton({ captionId }: { captionId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteMeme, initialState);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  useEffect(() => { if (confirming) cancel.current?.focus(); }, [confirming]);

  return (
    <div className="w-full border-t border-slate-200 pt-2">
      <button ref={trigger} type="button" aria-expanded={confirming} aria-controls={descriptionId} onClick={() => setConfirming(true)} hidden={confirming} className="cm-focus min-h-11 cursor-pointer rounded px-2 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700">Delete meme</button>
      {confirming ? (
        <form action={action} aria-busy={pending} className="rounded-xl border border-rose-200 bg-rose-50 p-3" onKeyDown={(event) => {
          if (event.key === "Escape" && !pending) { setConfirming(false); requestAnimationFrame(() => trigger.current?.focus()); }
        }}>
          <input type="hidden" name="captionId" value={captionId} />
          <p id={descriptionId} className="text-xs leading-5 text-rose-900"><strong>Delete this meme?</strong> Its votes will also be removed. This can’t be undone.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button ref={cancel} type="button" disabled={pending} onClick={() => { setConfirming(false); requestAnimationFrame(() => trigger.current?.focus()); }} className="cm-focus min-h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">Keep meme</button>
            <button type="submit" disabled={pending} aria-describedby={descriptionId} className="cm-focus min-h-11 cursor-pointer rounded-lg bg-rose-700 px-3 text-xs font-bold text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60">{pending ? "Deleting…" : "Delete permanently"}</button>
          </div>
          {state.message ? <p role="alert" className="mt-2 text-xs leading-5 text-rose-800">{state.message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
