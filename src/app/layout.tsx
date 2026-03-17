import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { PWARegister } from "@/components/shared/PWARegister";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], display: "swap" });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono-base", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "IndieThis — Everything an Independent Artist Needs",
  description: "AI creative tools, merch storefronts, studio booking, music sales, and your own artist site — all in one platform built for independent musicians.",
  openGraph: {
    title: "IndieThis — Everything an Independent Artist Needs",
    description: "AI creative tools, merch storefronts, studio booking, music sales, and your own artist site — all in one platform built for independent musicians.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${outfit.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#D4A843" />
      </head>
      <body>
        <PWARegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
