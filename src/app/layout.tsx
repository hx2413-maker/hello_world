import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import CampusAssistant from "@/components/campus-assistant";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Margins — Campus life, meme material",
  description: "Make AI memes from your photos and ideas. Share campus chaos, rate the good ones, and turn everyday Columbia life into your next group-chat favorite.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#f3f5f7] text-slate-900">
        <SiteHeader />
        {children}
        <CampusAssistant signedIn={Boolean(user)} />
      </body>
    </html>
  );
}
