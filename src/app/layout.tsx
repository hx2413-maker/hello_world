import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "City Margins — Campus life, meme material",
  description: "Make AI memes from your photos and ideas. Share campus chaos, rate the good ones, and find your daily dose of New York humor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#f3f5f7] text-slate-900">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
