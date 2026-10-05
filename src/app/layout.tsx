import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Reading Room | City Margins",
  description: "A little shelf of big ideas, and AI captions for life between chapters. Create a NYC caption and vote for your favorites.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
