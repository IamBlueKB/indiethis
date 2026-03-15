import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-base",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "IndieThis — Everything an Independent Artist Needs",
  description:
    "AI creative tools, merch storefronts, studio booking, music sales, and your own artist site — all in one platform built for independent musicians.",
  openGraph: {
    title: "IndieThis — Everything an Independent Artist Needs",
    description:
      "AI creative tools, merch storefronts, studio booking, music sales, and your own artist site — all in one platform built for independent musicians.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body
        className={`${outfit.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
