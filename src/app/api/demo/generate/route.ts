import { cookies } from "next/headers";
import { createAiUsageWriter, getDemoSecret, isSameOrigin, readBoundedBody } from "@/lib/ai-usage";
import { DEMO_COOKIE, privateDemoHash, verifyDemoIdentity } from "@/lib/demo-identity";
import { generateWithGemini, getGenerationConfig } from "@/lib/gemini";
import { buildPrompt, SYSTEM_PROMPT } from "@/lib/generation-contract";
import { ImageValidationError, MAX_IMAGE_BYTES, prepareMemeUpload } from "@/lib/meme-image";

export const runtime = "nodejs";
export const maxDuration = 45;

function quotaError(reason?: string) {
  return Response.json({ error: reason === "Demo already used." ? "You’ve used your image preview. Sign in to make more memes."
    : reason === "Demo network limit reached." ? "This network has used today’s three practice previews. Sign in to use your own generation allowance."
      : reason === "Demo shared limit reached." ? "Today’s free previews are all used. Come back tomorrow, or sign in to use the studio."
        : "The preview is temporarily unavailable. Please try later.", used: reason === "Demo already used." }, { status: reason?.includes("limit") || reason === "Demo already used." ? 429 : 503 });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Open the demo on this website." }, { status: 403 });
  const secret = getDemoSecret();
  const writer = createAiUsageWriter();
  const config = getGenerationConfig();
  if (!secret || !writer || !config) return Response.json({ error: "The image preview is temporarily unavailable. Practice voting is still available." }, { status: 503 });
  const guestId = verifyDemoIdentity((await cookies()).get(DEMO_COOKIE)?.value, secret);
  if (!guestId) return Response.json({ error: "Please refresh the page to start your private demo." }, { status: 403 });
  let requestId: string | null = null;
  try {
    const guestHash = privateDemoHash("guest", guestId, secret);
    // Vercel overwrites this header at its edge to prevent address spoofing.
    // Never accept a caller-supplied network identity on another host.
    const ip = process.env.VERCEL === "1"
      ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unavailable"
      : "local-development";
    const ipHash = privateDemoHash("ip", ip, secret);
    const status = await writer.demoAvailability(guestHash, ipHash);
    if (status.error) throw new Error("quota_unavailable");
    if (typeof status.data === "string") return quotaError(status.data);
    const contentType = request.headers.get("content-type");
    if (!contentType?.startsWith("multipart/form-data;")) return Response.json({ error: "Choose an image to try." }, { status: 400 });
    const bytes = await readBoundedBody(request, MAX_IMAGE_BYTES + 65_536);
    const form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: new Blob([Buffer.from(bytes)]) }).formData();
    const file = form.get("image");
    const context = form.get("scene") ?? "";
    if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose an image or GIF first." }, { status: 400 });
    if (typeof context !== "string" || context.trim().length > 280) return Response.json({ error: "Keep the optional scene to 280 characters." }, { status: 400 });
    const upload = await prepareMemeUpload(file);
    const scene = context.trim() || "Use the uploaded image to make a relatable Columbia campus-life joke.";
    const prompt = buildPrompt(scene, "witty", true) + (upload.animated ? `\nThe ${upload.frames.length} images are sampled frames of one animation, in chronological order. Use only visible details.` : "");
    const reservation = await writer.reserveDemo(guestHash, ipHash, prompt, SYSTEM_PROMPT, config.model);
    if (reservation.error || typeof reservation.data !== "string") {
      return quotaError(reservation.error?.message);
    }
    requestId = reservation.data;
    const output = await generateWithGemini(prompt, config, upload.frames);
    // Prompts and the result stay in a server-only audit record. The uploaded
    // image is processed in memory and never uploaded to public Storage.
    let saved = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await writer.finishDemo(requestId, output.body).catch(() => null);
      if (result && !result.error) { saved = true; break; }
    }
    if (!saved) throw new Error("preview_save_unconfirmed");
    return Response.json({ caption: output.body, used: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (requestId) await writer.finishDemo(requestId, null).catch(() => undefined);
    if (error instanceof ImageValidationError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === "body_too_large") return Response.json({ error: "Choose an image or GIF no larger than 2 MB." }, { status: 413 });
    return Response.json({ error: requestId ? "The AI couldn’t finish this preview. This attempt was used; sign in for more generation attempts." : "The preview could not be reached. Please try again later.", used: Boolean(requestId) }, { status: 503 });
  }
}
