"use client";

/**
 * Displays track/beat cover art with an IndieThis logo placeholder
 * when no coverArtUrl is provided. Drop-in for any card or detail view.
 */
export default function TrackArtwork({
  coverArtUrl,
  alt = "Track artwork",
  className = "",
}: {
  coverArtUrl: string | null | undefined;
  alt?:        string;
  className?:  string;
}) {
  if (coverArtUrl) {
    return (
      <img
        src={coverArtUrl}
        alt={alt}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ backgroundColor: "#111111" }}
    >
      {/* IndieThis logo mark — gold on dark */}
      <svg
        viewBox="0 0 40 40"
        width="40%"
        height="40%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Stylised "I" lettermark */}
        <rect x="16" y="4" width="8" height="32" rx="2" fill="#D4A843" />
        <rect x="8" y="4" width="24" height="5" rx="2" fill="#D4A843" />
        <rect x="8" y="31" width="24" height="5" rx="2" fill="#D4A843" />
      </svg>
    </div>
  );
}
