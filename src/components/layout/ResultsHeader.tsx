/**
 * Shared site header for AI tool results pages — mix console and
 * mastering. Mirrors PublicNav styling but with a results-tailored
 * link set so the page never feels like a dead end.
 *
 * Props:
 *   isGuest — true for tokenized guest routes (/mix-console/results,
 *             /master/results), false for subscriber dashboard routes.
 *             Guests get a "Mix/Master another track" CTA; subscribers
 *             get a Dashboard link.
 *   kind    — "mix" | "master" — controls which AI tool link appears
 *             in the nav and which guest CTA is shown.
 */

import Link from "next/link";

type Kind = "mix" | "master";

const TOOL_HREF: Record<Kind, string> = {
  mix:    "/mix-console",
  master: "/master",
};

const TOOL_LABEL: Record<Kind, string> = {
  mix:    "AI Mix Console",
  master: "AI Mastering",
};

const GUEST_CTA: Record<Kind, string> = {
  mix:    "Mix another track",
  master: "Master another track",
};

export function ResultsHeader({
  isGuest,
  kind,
}: {
  isGuest: boolean;
  kind:    Kind;
}) {
  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        backgroundColor: "rgba(10,10,10,0.92)",
        backdropFilter:  "blur(12px)",
        borderColor:     "#1a1a1a",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
        {/* Logo → home */}
        <Link href="/" className="shrink-0">
          <img
            src="/images/brand/indiethis-logo-dark-bg.svg"
            alt="IndieThis"
            style={{ height: 36, width: "auto" }}
          />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-0.5 shrink-0 ml-2">
          <Link
            href="/explore"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
            style={{ color: "#888" }}
          >
            Explore
          </Link>
          <Link
            href={TOOL_HREF[kind]}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
            style={{ color: "#888" }}
          >
            {TOOL_LABEL[kind]}
          </Link>
        </nav>

        <div className="flex-1" />

        {/* Right side — context-aware CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {isGuest ? (
            <Link
              href={TOOL_HREF[kind]}
              className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-90 whitespace-nowrap"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {GUEST_CTA[kind]}
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-90 whitespace-nowrap"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              Dashboard
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
