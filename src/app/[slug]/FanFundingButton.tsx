"use client";
import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import FanFundingModal from "./FanFundingModal";

interface Props {
  artistId:      string;
  artistName:    string;
  artistSlug:    string;
  supporterCount: number;
}

export default function FanFundingButton({ artistId, artistName, artistSlug, supporterCount }: Props) {
  const [open,    setOpen]    = useState(false);
  const [toasted, setToasted] = useState(false);

  // Show thank-you toast on ?funded=true redirect
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("funded") === "true") {
      setToasted(true);
      // Clean the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("funded");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => setToasted(false), 5000);
    }
  }, []);

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold transition-all hover:brightness-110"
          style={{ border: "1px solid #D4A843", color: "#D4A843", backgroundColor: "transparent" }}
        >
          <Heart size={14} />
          Support {artistName}
        </button>
        {supporterCount > 0 && (
          <p className="text-[12px] font-medium" style={{ color: "#D4A843" }}>
            Backed by {supporterCount} supporter{supporterCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {open && (
        <FanFundingModal
          artistId={artistId}
          artistName={artistName}
          onClose={() => setOpen(false)}
        />
      )}

      {/* Thank-you toast */}
      {toasted && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          Thank you for supporting {artistName}! 🎵
        </div>
      )}
    </>
  );
}
