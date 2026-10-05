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
};

export type GenerationState = {
  status: "idle" | "error" | "success";
  message?: string;
  captionId?: string;
};
export type VoteState = { status: "idle" | "error" | "success"; message?: string };

const dailyPrompts = [
  { label: "The main character commute", scene: "Reading on the 1 train, missing my stop because the chapter got good." },
  { label: "A very New York budget", scene: "A Columbia student taking a book and a bodega coffee on a very low-budget weekend adventure." },
  { label: "Library plot twist", scene: "Going to Butler Library to study, then spending an hour people-watching instead." },
  { label: "Small-town, big-city energy", scene: "A Midwesterner trying to make friendly eye contact with everyone on Broadway." },
  { label: "A seat by the river", scene: "Reading by the Hudson while the wind has strong opinions about which page comes next." },
  { label: "The weekend side quest", scene: "Setting out to explore downtown and ending up in a tiny bookstore for three hours." },
  { label: "Dorm-room daydreams", scene: "Trying to have a peaceful literary evening in a dorm where someone is always microwaving something." },
  { label: "A city in the margins", scene: "Finding a mysterious handwritten note in a secondhand book bought in New York." },
  { label: "Rain check", scene: "Getting caught in the rain outside a bookstore and calling it an excuse to buy another book." },
  { label: "Sunday reset, allegedly", scene: "Making an ambitious Sunday reading list, then spending the afternoon choosing the perfect cafe." },
  { label: "The campus wildlife review", scene: "A campus pigeon looking more prepared for my seminar than I am." },
  { label: "Between chapters", scene: "Sharing a tiny patch of sunlight on the Low Library steps with a book and a bagel." },
  { label: "Subway book club", scene: "Trying to read the title of a stranger's book on the subway without making it weird." },
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
