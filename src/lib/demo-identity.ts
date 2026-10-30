import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const DEMO_COOKIE = "campus_demo";
export const DEMO_COOKIE_AGE = 365 * 24 * 60 * 60;

function digest(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createDemoIdentity(secret: string) {
  const id = randomUUID();
  return `${id}.${digest(`campus-demo-cookie:v1:${id}`, secret)}`;
}

export function verifyDemoIdentity(value: string | undefined, secret: string): string | null {
  if (!value || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\.[a-f\d]{64}$/i.test(value)) return null;
  const [id, signature] = value.split(".");
  const expected = digest(`campus-demo-cookie:v1:${id}`, secret);
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex")) ? id : null;
}

export function privateDemoHash(kind: "guest" | "ip", value: string, secret: string) {
  return digest(`campus-demo-${kind}:v1:${value}`, secret);
}
