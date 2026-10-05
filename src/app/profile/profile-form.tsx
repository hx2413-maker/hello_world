"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveProfile } from "./actions";
import type { ProfileFormState } from "./types";

const initialState: ProfileFormState = { status: "idle", message: "" };
const inputClassName = "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 disabled:opacity-60";

type ProfileFormProps = {
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  email: string | undefined;
  next: string | null;
};

export function ProfileForm({ firstName, lastName, photoUrl, email, next }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  const [editedFirstName, setEditedFirstName] = useState(firstName ?? "");
  const [editedLastName, setEditedLastName] = useState(lastName ?? "");
  const [photoClientError, setPhotoClientError] = useState("");
  const photoError = photoClientError || state.fieldErrors?.photo;
  const initials = `${firstName?.trim().charAt(0) ?? ""}${lastName?.trim().charAt(0) ?? ""}` || "?";

  return (
    <form action={formAction} onSubmit={(event) => { if (photoClientError) event.preventDefault(); }} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-9" aria-busy={pending}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-wrap items-center gap-5 border-b border-slate-800 pb-8">
        {photoUrl ? (
          <Image src={photoUrl} alt="Your profile photo" width={88} height={88} unoptimized className="h-22 w-22 rounded-full border border-slate-700 object-cover" />
        ) : (
          <div className="flex h-22 w-22 items-center justify-center rounded-full border border-sky-300/20 bg-sky-300/10 text-2xl font-semibold text-sky-200" aria-label="No profile photo yet">{initials.toUpperCase()}</div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Your reader profile</h2>
          {email ? <p className="mt-1 break-all text-sm text-slate-400">{email}</p> : null}
          <p className="mt-2 text-sm text-slate-400">Make this little corner your own.</p>
        </div>
      </div>

      <fieldset disabled={pending} className="mt-8 space-y-7">
        <legend className="sr-only">Edit your profile</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="text-sm font-medium text-slate-200">First name <span className="text-slate-400">(required)</span></label>
            <input id="firstName" name="firstName" autoComplete="given-name" required maxLength={100} value={editedFirstName} onChange={(event) => setEditedFirstName(event.target.value)} aria-invalid={Boolean(state.fieldErrors?.firstName)} aria-describedby={state.fieldErrors?.firstName ? "firstName-error" : undefined} className={inputClassName} />
            {state.fieldErrors?.firstName ? <p id="firstName-error" className="mt-2 text-sm text-rose-300">{state.fieldErrors.firstName}</p> : null}
          </div>
          <div>
            <label htmlFor="lastName" className="text-sm font-medium text-slate-200">Last name <span className="text-slate-400">(required)</span></label>
            <input id="lastName" name="lastName" autoComplete="family-name" required maxLength={100} value={editedLastName} onChange={(event) => setEditedLastName(event.target.value)} aria-invalid={Boolean(state.fieldErrors?.lastName)} aria-describedby={state.fieldErrors?.lastName ? "lastName-error" : undefined} className={inputClassName} />
            {state.fieldErrors?.lastName ? <p id="lastName-error" className="mt-2 text-sm text-rose-300">{state.fieldErrors.lastName}</p> : null}
          </div>
        </div>

        <div>
          <label htmlFor="photo" className="text-sm font-medium text-slate-200">Profile photo <span className="text-slate-400">(optional)</span></label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && (file.size === 0 || file.size > 2 * 1024 * 1024)) {
              setPhotoClientError("Choose a nonempty image no larger than 2 MB.");
            } else if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
              setPhotoClientError("Choose a JPEG, PNG, or WebP image.");
            } else {
              setPhotoClientError("");
            }
          }} aria-invalid={Boolean(photoError)} aria-describedby={`photo-help${photoError ? " photo-error" : ""}`} className="mt-3 block w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:font-medium file:text-sky-200 hover:file:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300" />
          <p id="photo-help" className="mt-2 text-sm text-slate-400">JPEG, PNG, or WebP, up to 2 MB. Leave this empty to keep your current photo.</p>
          {photoError ? <p id="photo-error" role="alert" className="mt-2 text-sm text-rose-300">{photoError}</p> : null}
          {photoUrl ? (
            <div className="mt-5">
              <label className="flex items-center gap-3 text-sm text-slate-200">
                <input type="checkbox" name="removePhoto" aria-describedby="remove-photo-help" className="h-4 w-4 rounded border-slate-600 accent-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300" />
                Remove current photo
              </label>
              <p id="remove-photo-help" className="mt-2 text-sm text-slate-400">Leave the upload empty, check this box, and save your profile to remove your photo.</p>
            </div>
          ) : null}
        </div>

        <button type="submit" disabled={pending || Boolean(photoClientError)} className="rounded-full bg-sky-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Saving your profile…" : next ? "Save & continue to City Margins" : "Save profile"}</button>
      </fieldset>

      <div aria-live="polite" aria-atomic="true">
        {state.message ? (
          <div className={`mt-6 rounded-xl border p-4 text-sm leading-6 ${state.status === "error" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-sky-300/30 bg-sky-300/10 text-sky-100"}`} role={state.status === "error" ? "alert" : "status"}>
            <p>{state.message}</p>
            {state.status === "success" ? <Link href="/members" className="mt-2 inline-block font-semibold underline underline-offset-4 hover:text-white">Enter the members’ reading room →</Link> : null}
            {state.status === "error" && state.message.includes("sign in") ? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="mt-2 inline-block font-semibold underline underline-offset-4">Sign in again →</Link> : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
