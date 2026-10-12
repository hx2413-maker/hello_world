export const VIBES = ["witty", "poetic", "deadpan"] as const;
export type Vibe = (typeof VIBES)[number];

export type Caption = {
  id: string;
  body: string;
  vibe: Vibe;
  created_at: string;
  upvotes: number;
  downvotes: number;
  score: number;
  viewer_vote: number | null;
  is_owner: boolean;
  is_starter: boolean;
  image_path: string | null;
  image_url: string | null;
};

export type GenerationRequest = {
  id: string;
  scene: string;
  vibe: Vibe;
  prompt: string;
  system_prompt: string;
  model: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
  image_path: string | null;
};

export type GenerationState = {
  status: "idle" | "error" | "success";
  message?: string;
  captionId?: string;
};
export type VoteState = { status: "idle" | "error" | "success"; message?: string };

const dailyPrompts = [
  { label: "The main character commute", scene: "The 1 train doors closing right as I arrive, already late for a Columbia seminar." },
  { label: "A very New York budget", scene: "A Columbia student realizing their weekend budget is one bodega coffee." },
  { label: "Library plot twist", scene: "Going to Butler Library to study, then spending an hour people-watching instead." },
  { label: "Small-town, big-city energy", scene: "A Midwesterner trying to make friendly eye contact with everyone on Broadway." },
  { label: "A seat by the river", scene: "Trying to look mysterious by the Hudson while the wind steals my bagel wrapper." },
  { label: "The weekend side quest", scene: "Setting out to explore downtown and accidentally taking the train in the wrong direction." },
  { label: "Dorm-room daydreams", scene: "Trying to sleep in a Columbia dorm where someone is always microwaving something." },
  { label: "Dining hall diplomacy", scene: "Strategically timing my dining hall trip around every person I am avoiding on campus." },
  { label: "Rain check", scene: "Getting caught in NYC rain with an umbrella that immediately turns inside out." },
  { label: "Sunday reset, allegedly", scene: "Making an ambitious Sunday study plan, then spending the afternoon choosing the perfect cafe." },
  { label: "The campus wildlife review", scene: "A campus pigeon looking more prepared for my seminar than I am." },
  { label: "Low effort", scene: "Sharing a tiny patch of sunlight on the Low steps with a bagel and three missed deadlines." },
  { label: "Subway etiquette", scene: "A Midwesterner politely waiting for everyone to exit the subway while three trains go by." },
  { label: "Home, in progress", scene: "Walking back to my dorm after a weekend in the city and realizing New York is starting to feel like home." },
];

export function getDailyPrompt(date = new Date()) {
  // One shared brief per UTC day. Visitors see the same prompt across time zones.
  const day = Math.floor(date.getTime() / 86_400_000);
  return dailyPrompts[((day % dailyPrompts.length) + dailyPrompts.length) % dailyPrompts.length];
}

export function isVibe(value: unknown): value is Vibe {
  return typeof value === "string" && VIBES.includes(value as Vibe);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validateScene(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const scene = value.trim();
  return scene.length >= 10 && scene.length <= 280 ? scene : null;
}
