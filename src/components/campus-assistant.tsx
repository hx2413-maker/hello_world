"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { generateCaption } from "@/app/margins/actions";
import type { GenerationState } from "@/lib/margins-shared";
import type { AssistantAction, AssistantMessage } from "@/lib/assistant-contract";

type ChatMessage = AssistantMessage & { actions?: AssistantAction[] };

function MemeProposal({ action }: { action: Extract<AssistantAction, { kind: "generate" }> }) {
  const [state, formAction, pending] = useActionState(generateCaption, { status: "idle" } as GenerationState);
  const [submitted, setSubmitted] = useState(false);
  const complete = submitted && !pending && state.status !== "error";
  return <form action={formAction} onSubmit={() => setSubmitted(true)} className="mt-3 rounded-xl border border-[#c4d8ec] bg-white p-3 text-slate-800">
    <p className="text-xs font-bold uppercase tracking-wide text-[#245b89]">Meme idea · {action.tone}</p>
    <p className="mt-1 text-sm leading-relaxed">{action.scene}</p>
    <input type="hidden" name="scene" value={action.scene} />
    <input type="hidden" name="vibe" value={action.tone} />
    <p className="mt-2 text-xs leading-relaxed text-slate-500">Creates a public AI caption. Uses one of your daily generation attempts.</p>
    <button disabled={pending || complete} className="cm-focus mt-3 min-h-11 w-full rounded-lg bg-[#245b89] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{pending ? "Generating…" : complete ? "Submitted to the feed" : "Generate & publish"}</button>
    <Link href={action.href} className="cm-focus mt-1 flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold text-[#245b89] hover:underline">Edit in studio / add an image</Link>
    {state.status === "error" ? <p role="alert" className="mt-2 text-xs leading-relaxed text-red-700">{state.message}</p> : null}
  </form>;
}

export default function CampusAssistant({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A successful server-action publication redirects to the new meme. Closing
  // the persistent layout dialog makes that result visible immediately.
  useEffect(() => { dialogRef.current?.close(); }, [pathname]);

  useEffect(() => {
    if (dialogRef.current?.open) lastMessageRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, pending, error]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/campus-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-8).map(({ role, content: text }) => ({ role, content: text })) }),
        signal: AbortSignal.timeout(35_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The assistant is unavailable. Please try again later.");
      setMessages([...next, { role: "assistant", content: data.message, actions: data.actions }]);
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "That took too long. Please try again later.");
    } finally { setPending(false); }
  }

  const close = () => dialogRef.current?.close();
  return <>
    <button onClick={() => dialogRef.current?.showModal()} aria-haspopup="dialog" className="cm-focus fixed right-4 bottom-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-[#173e5a] px-4 py-3 text-sm font-bold text-white shadow-lg sm:right-6 sm:bottom-6">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z" /><path d="M8 10h8M8 14h5" /></svg>
      Campus helper
    </button>
    <dialog ref={dialogRef} aria-labelledby="campus-helper-title" className="fixed inset-auto right-3 bottom-3 m-0 max-h-[calc(100dvh-24px)] w-[min(410px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#d4e2ee] bg-[#f5f8fb] p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/25 sm:right-6 sm:bottom-6" onClick={(event) => { if (event.target === dialogRef.current) { const rect = dialogRef.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }}>
      <div className="flex items-center justify-between border-b border-[#dbe5ed] bg-white px-4 py-3">
        <div><h2 id="campus-helper-title" className="font-bold text-[#173e5a]">Campus helper</h2><p className="text-xs text-slate-500">Find your way. Make a meme.</p></div>
        <button onClick={close} aria-label="Close campus helper" className="cm-focus flex h-11 w-11 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100">×</button>
      </div>
      <div className="max-h-[55dvh] overflow-y-auto p-4">
        <p className="text-sm leading-relaxed">{signedIn ? "Tell me where you want to go, or describe a campus moment. I’ll prepare a meme idea for you to review." : "New here? Try a few practice votes and one private image-caption preview. Sign in when you’re ready to publish."}</p>
        <nav aria-label="Assistant shortcuts" className="mt-3 flex flex-wrap gap-2">
          {[{ href: "/demo", text: "Try the demo" }, { href: "/templates", text: "Meme images" }, { href: "/margins?sort=top", text: "Top memes" }].map((link) => <Link key={link.href} href={link.href} onClick={close} className="cm-focus rounded-full border border-[#c4d8ec] bg-white px-3 py-2.5 text-xs font-semibold text-[#245b89] hover:bg-[#edf4fa]">{link.text}</Link>)}
        </nav>
        {signedIn ? <div role="log" aria-label="Conversation with campus helper" aria-live="polite" className="mt-4 space-y-3">
          {messages.map((message, index) => <div key={index} className={`rounded-xl p-3 ${message.role === "user" ? "ml-5 bg-[#245b89] text-white" : "mr-2 border border-[#dbe5ed] bg-white"}`}>
            <span className="sr-only">{message.role === "user" ? "You: " : "Campus helper: "}</span>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
            {message.actions?.map((action, actionIndex) => action.kind === "generate" ? <MemeProposal key={actionIndex} action={action} /> : <Link key={actionIndex} href={action.href} onClick={close} className="cm-focus mt-2 inline-flex min-h-11 items-center rounded-lg border border-[#c4d8ec] bg-[#edf4fa] px-3 text-sm font-bold text-[#245b89]">{action.label} →</Link>)}
          </div>)}
          {pending ? <p className="text-sm text-slate-500">Thinking about your campus moment…</p> : null}
          {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
          <div ref={lastMessageRef} />
        </div> : <Link href="/login?next=%2Fcreate" onClick={close} className="cm-focus mt-4 flex min-h-11 items-center justify-center rounded-lg bg-[#245b89] px-3 text-sm font-bold text-white">Sign in to chat and create</Link>}
      </div>
      {signedIn ? <form onSubmit={send} className="border-t border-[#dbe5ed] bg-white p-3">
        <label htmlFor="campus-helper-message" className="sr-only">Message the campus helper</label>
        <div className="flex gap-2"><input id="campus-helper-message" value={input} onChange={(event) => setInput(event.target.value)} maxLength={600} placeholder="Make a meme about finals…" disabled={pending} className="cm-focus min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" /><button disabled={pending || !input.trim()} className="cm-focus min-h-11 rounded-lg bg-[#245b89] px-3 text-sm font-bold text-white disabled:opacity-40">Send</button></div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">AI can make mistakes. Chat is sent to Gemini. 20 requests per person daily; publishing uses your studio allowance.</p>
      </form> : null}
    </dialog>
  </>;
}
