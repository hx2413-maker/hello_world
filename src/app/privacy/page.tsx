import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy | The Reading Room",
  description: "How The Reading Room uses sign-in and profile information.",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 bg-slate-950 px-6 py-14 text-white sm:px-12 sm:py-20">
      <article className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-300">The Reading Room</p>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">Privacy notice</h1>
        <p className="mt-6 text-lg leading-8 text-slate-400">The Reading Room is an educational app with a public book collection, AI captions in City Margins, and a member area. This notice describes how the app uses your information.</p>

        <div className="mt-12 space-y-9 border-t border-slate-800 pt-9 text-slate-300">
          <section aria-labelledby="sign-in-privacy-heading">
            <h2 id="sign-in-privacy-heading" className="text-xl font-semibold text-white">Google sign-in</h2>
            <p className="mt-3 leading-7">When you continue with Google, Google shares basic account information with Supabase Auth, including your account identifier, email address, name, and profile photo when available. This information is used to create and recognize your account. The Reading Room does not receive your Google password.</p>
          </section>

          <section aria-labelledby="profile-privacy-heading">
            <h2 id="profile-privacy-heading" className="text-xl font-semibold text-white">Your profile and photo</h2>
            <p className="mt-3 leading-7">The first and last names you enter are stored in the app’s Supabase database and used to personalize your member area. You can change them in Profile. Uploading a profile photo is optional; the file is stored in Supabase Storage, and the database stores its file path.</p>
            <p className="mt-3 leading-7">The app restricts profile and photo access to the signed-in owner. Photos are displayed through temporary links that expire after one hour. Anyone with a temporary photo link can view that photo until the link expires, so avoid sharing it if you want to keep the photo private.</p>
          </section>

          <section aria-labelledby="captions-privacy-heading">
            <h2 id="captions-privacy-heading" className="text-xl font-semibold text-white">AI captions and votes</h2>
            <p className="mt-3 leading-7">When you generate a caption, your scene and the app’s writing instructions are sent to Google’s Gemini API. The app stores the scene, complete prompts, model, usage information, time, and generation status in Supabase, linked to your account. These records are readable only by you through the app and by its administrators. Failed attempts are also retained to enforce the daily limit.</p>
            <p className="mt-3 leading-7">A completed caption and its tone are published automatically and can be read or shared by anyone. The AI may include details from your scene in that public caption, so leave out personal or confidential information. Your profile name and email are not attached to the public caption. Votes are linked to your account; other visitors see totals, not your individual vote or identity.</p>
            <p className="mt-3 leading-7">Google processes prompts under its <a href="https://ai.google.dev/gemini-api/terms" className="text-sky-300 underline underline-offset-4">Gemini API terms</a>. Depending on the service tier, Google may use submitted content to improve its products. You can change or remove a vote at any time. Contact the app owner to request deletion of captions or your account data.</p>
          </section>

          <section aria-labelledby="services-privacy-heading">
            <h2 id="services-privacy-heading" className="text-xl font-semibold text-white">Sessions and service providers</h2>
            <p className="mt-3 leading-7">The app uses session cookies to keep you signed in and to control access to your profile and member area. Sign out to end the app session in your browser. Vercel hosts the application, and Supabase provides authentication, the database, and photo storage.</p>
          </section>

          <section aria-labelledby="contact-privacy-heading">
            <h2 id="contact-privacy-heading" className="text-xl font-semibold text-white">Questions or deletion requests</h2>
            <p className="mt-3 leading-7">To ask about your information or request deletion of your account, profile, and uploaded photo, contact the app owner at <a href="mailto:hanyuxie1234@gmail.com" className="break-all rounded-sm text-sky-300 underline decoration-sky-300/40 underline-offset-4 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">hanyuxie1234@gmail.com</a>.</p>
          </section>
        </div>

        <Link href="/books" className="mt-12 inline-block rounded-md text-sm font-semibold text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">← Back to the books</Link>
      </article>
    </main>
  );
}
