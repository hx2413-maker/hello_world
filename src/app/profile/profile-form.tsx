"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { MAX_DISPLAY_NAME_LENGTH, type MemberProfile, type ProfileState } from "@/lib/profile-shared";
import { saveProfile } from "./actions";

const initialState: ProfileState = { status: "idle" };

export function ProfileForm({ initialProfile }: { initialProfile: MemberProfile | null }) {
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? "");
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [imageError, setImageError] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef("");

  const [state, formAction, pending] = useActionState(async (previous: ProfileState, formData: FormData): Promise<ProfileState> => {
    // React resets file inputs after actions; keep the chosen file for a retry.
    if (selectedAvatar) formData.set("avatar", selectedAvatar);
    else formData.delete("avatar");
    if (removeAvatar) formData.set("removeAvatar", "true");
    else formData.delete("removeAvatar");
    let result: ProfileState;
    try {
      result = await saveProfile(previous, formData);
    } catch {
      result = { status: "error", message: "We couldn’t save your profile just now. Your changes are still here; please try again." };
    }
    if (result.status === "success" && result.profile) {
      setSavedProfile(result.profile);
      setDisplayName(result.profile.display_name);
      clearSelection();
      setRemoveAvatar(false);
    }
    setShowFeedback(true);
    return result;
  }, initialState);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  function clearSelection() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setPreviewUrl("");
    setSelectedAvatar(null);
    setImageError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function chooseAvatar(file: File | undefined) {
    if (!file) return;
    clearSelection();
    setShowFeedback(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setImageError("Choose a nonempty image no larger than 2 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreviewUrl(url);
    setSelectedAvatar(file);
    setRemoveAvatar(false);
  }

  function cancelChanges() {
    clearSelection();
    setDisplayName(savedProfile?.display_name ?? "");
    setRemoveAvatar(false);
    setShowFeedback(false);
  }

  const visibleAvatar = previewUrl || (removeAvatar ? null : savedProfile?.avatar_url);
  const changed = displayName !== (savedProfile?.display_name ?? "") || Boolean(selectedAvatar) || removeAvatar;

  return (
    <form action={formAction} aria-busy={pending} onSubmit={(event) => { if (imageError) event.preventDefault(); }}>
      <fieldset disabled={pending} className="disabled:opacity-70">
        <legend className="sr-only">Public profile details</legend>
        <div className="flex items-center gap-5 border-b border-[#dbe6ef] bg-[#edf4fa] p-5 sm:gap-6 sm:p-7">
          <Avatar src={visibleAvatar} name={displayName} size={80} alt="Your profile photo preview" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#486b87]">Your public profile</p>
            <p className="mt-1.5 break-words text-xl font-bold tracking-tight text-[#254965] sm:text-2xl">{displayName.trim() || "Your name here"}</p>
            <p className="mt-1 text-xs leading-5 text-[#486b87]">The person behind the punchline.</p>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          <div>
            <label htmlFor="display-name" className="text-sm font-bold text-slate-700">Display name</label>
            <input id="display-name" name="displayName" type="text" autoComplete="nickname" required minLength={1} value={displayName} onChange={(event) => { setDisplayName(Array.from(event.target.value).slice(0, MAX_DISPLAY_NAME_LENGTH).join("")); setShowFeedback(false); }} aria-describedby="name-help name-count" placeholder="What should we call you?" className="cm-field mt-2 block px-3.5 py-3 text-base sm:text-sm" />
            <div className="mt-2 flex items-start justify-between gap-3 text-xs leading-5 text-slate-500">
              <p id="name-help">A name or nickname you want to share.</p>
              <span id="name-count" className="shrink-0 tabular-nums text-slate-500">{Array.from(displayName).length}/{MAX_DISPLAY_NAME_LENGTH}</span>
            </div>
          </div>

          <div>
            <label htmlFor="profile-avatar" className="text-sm font-bold text-slate-700">Profile photo</label>
            <input ref={fileInput} id="profile-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseAvatar(event.target.files?.[0])} aria-invalid={Boolean(imageError)} aria-describedby="avatar-help avatar-error" className="cm-focus mt-2 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#e5eff7] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#245b89]" />
            <p id="avatar-help" className="mt-2 text-xs leading-5 text-slate-500">JPEG, PNG, or WebP · up to 2 MB. Your photo is cropped to a square.</p>
            {selectedAvatar ? <p className="mt-2 break-words text-xs text-[#245b89]">Selected: {selectedAvatar.name}</p> : null}
            <p id="avatar-error" role={imageError ? "alert" : undefined} className="mt-1 text-xs leading-5 text-rose-700">{imageError}</p>
            {selectedAvatar || (savedProfile?.avatar_path && !removeAvatar) ? <button type="button" onClick={() => { clearSelection(); setRemoveAvatar(Boolean(savedProfile?.avatar_path)); setShowFeedback(false); }} className="cm-focus mt-2 min-h-11 cursor-pointer rounded text-xs font-semibold text-rose-700 hover:text-rose-900">Remove photo</button> : null}
            {removeAvatar ? <p className="mt-2 text-xs leading-5 text-slate-500">Your photo will be removed from your profile when you save. Your initials will appear instead.</p> : null}
          </div>

          <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">Saving makes your chosen name and photo public on your profile, even if you haven’t posted yet, and beside all your memes. Your email stays private.</p>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending || Boolean(imageError) || !changed} className="cm-focus min-h-11 cursor-pointer rounded-lg bg-[#245b89] px-5 text-sm font-bold text-white hover:bg-[#19456c] disabled:cursor-default disabled:opacity-50">{pending ? "Saving…" : "Save changes"}</button>
            <button type="button" disabled={pending || (!changed && !imageError)} onClick={cancelChanges} className="cm-focus min-h-11 cursor-pointer rounded-lg px-4 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-default disabled:opacity-40">Cancel</button>
            {changed && !pending ? <span className="text-xs text-slate-500">Unsaved changes</span> : null}
          </div>
        </div>
      </fieldset>

      <div aria-live="polite" aria-atomic="true" className="px-5 sm:px-7">
        {pending ? <p role="status" className="mb-5 text-xs leading-6 text-[#245b89]">Saving your profile…</p> : null}
        {!pending && showFeedback && state.message ? <div role={state.status === "error" ? "alert" : "status"} className={`mb-5 rounded-lg border p-3 text-xs leading-6 ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-[#c5dbed] bg-[#edf4fa] text-[#245b89]"}`}><p>{state.message}</p>{state.status === "error" && state.message.toLowerCase().includes("sign in") ? <Link href="/login?next=%2Fprofile" className="mt-1 inline-block font-bold underline underline-offset-4">Sign in again →</Link> : null}</div> : null}
      </div>
    </form>
  );
}
