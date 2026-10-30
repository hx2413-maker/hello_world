import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy | Campus Margins", description: "How Campus Margins handles your account, images, AI prompts, and votes." };

export default function PrivacyPage() {
  return (
    <main className="flex-1 px-5 py-10 sm:py-14">
      <article className="cm-card mx-auto max-w-3xl rounded-2xl p-7 sm:p-12">
        <Link href="/margins" className="cm-focus rounded text-xs font-bold text-[#245b89] hover:underline">← Back to the feed</Link>
        <p className="mt-9 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7097b6]">Campus Margins</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy, in plain language.</h1>
        <p className="mt-5 text-sm leading-7 text-slate-500">Campus Margins is an educational meme app. You can browse publicly, or sign in to create AI captions and vote. Here’s what happens to your information.</p>

        <div className="mt-9 space-y-8 border-t border-slate-200 pt-8 text-sm leading-7 text-slate-600">
          <section aria-labelledby="account-privacy"><h2 id="account-privacy" className="text-lg font-bold text-slate-900">Your Google account</h2><p className="mt-3">Google shares basic account information with Supabase Auth, including your account identifier, email, name, and account photo when available. We use this to recognize your account and keep your votes and creations connected to you. Campus Margins does not receive your Google password.</p></section>

          <section aria-labelledby="creation-privacy"><h2 id="creation-privacy" className="text-lg font-bold text-slate-900">Images, prompts, and AI captions</h2><p className="mt-3">When you generate a meme, your image (if uploaded), text idea or context, and the app’s creative instructions are sent to Google Gemini. Uploaded images are stored in Supabase Storage. The database stores generation prompts, model, usage information, timestamps, and status linked to your account. Failed generation attempts are retained to enforce usage limits.</p><p className="mt-3">A successful generation automatically publishes your image and AI caption to the public feed. Anyone can view or share the meme. Only upload images you have permission to share, and avoid personal or confidential content. Your saved prompts are visible only to you through the app and to administrators, but the AI may repeat information from them in the public caption.</p><p className="mt-3">Google processes submissions under its <a href="https://ai.google.dev/gemini-api/terms" className="cm-focus rounded font-medium text-[#245b89] underline underline-offset-4">Gemini API terms</a>. Do not submit sensitive information.</p></section>

          <section aria-labelledby="votes-privacy"><h2 id="votes-privacy" className="text-lg font-bold text-slate-900">Your profile and votes</h2><p className="mt-3">You can choose a display name and upload an avatar through Edit profile. Saving them makes them visible on your public profile, even before you publish a meme, and beside your published memes. Your Google name and photo are not automatically published, and your email stays private. Avatars are stored in Supabase, resized, and stripped of embedded metadata; they are not sent to Gemini. You can replace or remove your avatar. Removing it hides it from your profile and memes; previously issued image links can take up to five minutes to expire. The stored copy remains private and is overwritten by your next avatar upload.</p><p className="mt-3">Votes are linked to your account so you can change or remove them. Other visitors see vote totals, not individual voters. Starter examples are labeled separately from community creations.</p></section>

          <section aria-labelledby="meme-deletion"><h2 id="meme-deletion" className="text-lg font-bold text-slate-900">Deleting your memes</h2><p className="mt-3">While signed in, choose Delete meme on your public profile or the meme’s page. Only you can delete your posts. Deletion removes the public meme and its votes. A private record of the generation remains to enforce usage limits and review service activity.</p></section>

          <section aria-labelledby="shared-tones"><h2 id="shared-tones" className="text-lg font-bold text-slate-900">Community tones and templates</h2><p className="mt-3">Saving a tone makes its name, style description, and creator profile public so others can reuse it. Only its creator can remove it; existing memes keep their saved tone and generation prompt. Custom tone descriptions are sent to Gemini when used. Template previews load from Imgflip, which receives the usual browser network information. When you publish with a template, a processed copy is stored with your meme.</p></section>

          <section aria-labelledby="demo-privacy"><h2 id="demo-privacy" className="text-lg font-bold text-slate-900">The practice page</h2><p className="mt-3">Practice ratings stay in your browser and never affect real vote totals. The guest image trial sends your image and context to Gemini to make one private preview. The image is processed in memory and is not uploaded to our image storage or published. We retain the generated caption, prompt, model, status, and timestamp in a private usage record accessible to administrators.</p><p className="mt-3">A signed guest cookie lasts up to one year. We store hashed guest and network identifiers to enforce one trial per browser, a daily network limit, and a daily shared limit. The quota database does not store your raw IP address. Hosting providers may retain routine request logs. Clearing browser data can remove your practice ratings and guest cookie; it does not remove existing private usage records.</p></section>

          <section aria-labelledby="assistant-privacy"><h2 id="assistant-privacy" className="text-lg font-bold text-slate-900">The campus assistant</h2><p className="mt-3">When signed in, the chat sends a bounded conversation to Google Gemini to suggest navigation or prepare a meme idea. Chat messages are not saved in our database. We record your account and request time to enforce daily assistant limits. Generating from a chat draft requires you to choose Generate &amp; publish and follows the same public-publishing rules and quotas as the studio.</p></section>

          <section aria-labelledby="services-privacy"><h2 id="services-privacy" className="text-lg font-bold text-slate-900">Cookies and service providers</h2><p className="mt-3">Session cookies keep you signed in. A short-lived cookie can remember which meme you were viewing during sign-in. Sign out to end the app session in this browser. Vercel hosts the app; Supabase provides authentication, database storage, and image storage; Google Gemini generates captions.</p></section>

          <section aria-labelledby="contact-privacy"><h2 id="contact-privacy" className="text-lg font-bold text-slate-900">Questions or account deletion</h2><p className="mt-3">To ask about your information or request deletion of your account or other stored information, contact <a href="mailto:hanyuxie1234@gmail.com" className="cm-focus break-all rounded font-medium text-[#245b89] underline underline-offset-4">hanyuxie1234@gmail.com</a>.</p></section>
        </div>
      </article>
    </main>
  );
}
