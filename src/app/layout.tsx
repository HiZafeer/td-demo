import type { Metadata } from "next";
import { CommerceProvider } from "@/components/commerce-provider";
import { SiteShell } from "@/components/site-shell";
import { loadDemoBootstrap } from "@/lib/server-storefront";
import "./globals.css";

export const metadata: Metadata = { title: "Tossdown · Commerce Demo", description: "A third-party host demo for Tossdown cart and checkout packages." };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const bootstrap = await loadDemoBootstrap();
  return <html lang="en"><body suppressHydrationWarning><CommerceProvider bootstrap={bootstrap}><SiteShell>{children}</SiteShell></CommerceProvider></body></html>;
}
