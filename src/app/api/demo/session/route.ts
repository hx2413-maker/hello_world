import { cookies } from "next/headers";
import { createAiUsageWriter, getDemoSecret, isSameOrigin } from "@/lib/ai-usage";
import { createDemoIdentity, DEMO_COOKIE, DEMO_COOKIE_AGE, privateDemoHash, verifyDemoIdentity } from "@/lib/demo-identity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Open the demo on this website." }, { status: 403 });
  const secret = getDemoSecret();
  const writer = createAiUsageWriter();
  if (!secret || !writer) return Response.json({ error: "The image preview is temporarily unavailable. Practice voting is still available." }, { status: 503 });
  try {
    const jar = await cookies();
    let token = jar.get(DEMO_COOKIE)?.value;
    let id = verifyDemoIdentity(token, secret);
    if (!id) {
      token = createDemoIdentity(secret);
      id = verifyDemoIdentity(token, secret)!;
      jar.set(DEMO_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: DEMO_COOKIE_AGE });
    }
    const { data, error } = await writer.demoStatus(privateDemoHash("guest", id, secret));
    if (error) throw new Error("quota_unavailable");
    return Response.json({ used: data === true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The image preview could not be reached. Please refresh to try again." }, { status: 503 });
  }
}
