export const MAX_DISPLAY_NAME_LENGTH = 40;

export type MemberProfile = {
  display_name: string;
  avatar_path: string | null;
  avatar_url: string | null;
  updated_at: string;
};

export type ProfileState = {
  status: "idle" | "success" | "error";
  message?: string;
  profile?: MemberProfile;
};

export function validateDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 && [...name].length <= MAX_DISPLAY_NAME_LENGTH && !/[\p{Cc}\p{Cf}]/u.test(name)
    ? name : null;
}
