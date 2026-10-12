import type { SVGProps } from "react";

type IconName = "sparkles" | "image" | "up" | "down" | "link" | "bolt";
const paths: Record<IconName, string> = {
  sparkles: "m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3ZM20 2v4M18 4h4",
  image: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-2 13 5-5 6 6 3-3 4 4M8 7h.01",
  up: "m5 12 7-7 7 7M12 5v14",
  down: "m5 12 7 7 7-7M12 19V5",
  link: "m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7l1-7Z",
};

export function MemeIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}><path d={paths[name]} /></svg>;
}
