export const VIBES = ["witty", "poetic", "deadpan"] as const;
export type Vibe = (typeof VIBES)[number];

export type Caption = {
  id: string;
  body: string;
  vibe: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  score: number;
  viewer_vote: number | null;
  is_owner: boolean;
  is_starter: boolean;
  image_path: string | null;
  image_url: string | null;
  author_name: string | null;
  author_id: string | null;
  author_avatar_path: string | null;
  author_avatar_url: string | null;
  author_updated_at: string | null;
};

export type GenerationRequest = {
  id: string;
  scene: string;
  vibe: string;
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
export type DeleteMemeState = { status: "idle" | "error"; message?: string };

const dailyPrompts = [
  { label: "Library plot twist", scene: "Going to Butler Library to study, then spending an hour choosing the perfect seat." },
  { label: "Dorm-room daydreams", scene: "Trying to sleep in a Columbia dorm where someone is always microwaving something." },
  { label: "Dining hall diplomacy", scene: "Strategically timing my dining hall trip around every person I am avoiding on campus." },
  { label: "The reading will wait", scene: "Opening the Core syllabus and discovering that the optional reading is longer than the required reading." },
  { label: "Sunday reset, allegedly", scene: "Making an ambitious Sunday study plan, then spending the afternoon reorganizing my dorm desk." },
  { label: "The campus wildlife review", scene: "A campus pigeon looking more prepared for my seminar than I am." },
  { label: "Low effort", scene: "Sharing a tiny patch of sunlight on the Low steps with a bagel and three missed deadlines." },
  { label: "Group project energy", scene: "The group project document has five cursors and somehow still has zero words." },
  { label: "Office hours courage", scene: "Rehearsing my office hours question ten times only to forget it when the professor says hello." },
  { label: "Laundry day lore", scene: "Setting six timers for the dorm laundry and still arriving after someone moved my clothes." },
  { label: "Registration roulette", scene: "Building the perfect class schedule and watching every section fill up during registration." },
  { label: "A Ferris side quest", scene: "Walking into Ferris for a quick lunch and accidentally staying until my next seminar." },
  { label: "Club fair ambitions", scene: "Signing up for twelve Columbia clubs even though I barely have time for my current classes." },
  { label: "The seminar nod", scene: "Nodding thoughtfully in a Core seminar while trying to remember which book we are discussing." },
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
