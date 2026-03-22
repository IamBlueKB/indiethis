"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, ShoppingBag } from "lucide-react";

const DEMO_TRACK = {
  title: "Dark Energy",
  artist: "Marcus Webb",
  city: "Atlanta, GA",
  coverArt: "/images/brand/indiethis-icon.svg",
  audioUrl: "/demo/beat-128bpm.wav",
};

const MERCH_ITEMS = [
  { name: "Black Hoodie", price: "$45", bg: "#1a1a1a" },
  { name: "Gold Tee", price: "$28", bg: "#1a1a1a" },
  { name: "Snapback", price: "$35", bg: "#1a1a1a" },
];

function WaveformPlayer({ audioUrl }: { audioUrl: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      setProgress((audio.currentTime / (audio.duration || 1)) * 100);
    });
    audio.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    return () => { audio.pause(); audio.src = ""; };
  }, [audioUrl]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const bars = Array.from({ length: 48 }, (_, i) => {
    const h = Math.abs(Math.sin(i * 0.8 + 1.2) * 0.6 + Math.sin(i * 0.3) * 0.4);
    const filled = (i / 48) * 100 < progress;
    return { h: Math.round(12 + h * 28), filled };
  });

  return (
    <div className="flex items-center gap-3">
      <button
        id="demo-play-btn"
        onClick={toggle}
        style={{
          width: 36, height: 36,
          borderRadius: "50%",
          backgroundColor: "#D4A843",
          color: "#0A0A0A",
          border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, height: 40 }}>
        {bars.map((bar, i) => (
          <div key={i} style={{
            width: 3,
            height: bar.h,
            borderRadius: 2,
            backgroundColor: bar.filled ? "#D4A843" : "rgba(212,168,67,0.25)",
            transition: "background-color 0.1s",
            flexShrink: 0,
          }} />
        ))}
      </div>
    </div>
  );
}

export default function ImmersivePlayerCard() {
  return (
    <section id="player-section" className="py-20 px-6" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-xl mx-auto text-center">
        {/* Label */}
        <p style={{ fontSize: "10px", color: "#D4A843", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 24, fontWeight: 700 }}>
          THIS IS ONE ARTIST PAGE ON INDIETHIS
        </p>

        {/* Card */}
        <div style={{
          backgroundColor: "#111",
          borderRadius: 14,
          maxWidth: 440,
          margin: "0 auto",
          padding: 24,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {/* Cover + info */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 8,
              backgroundColor: "#1a1a1a",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0,
            }}>
              <img src={DEMO_TRACK.coverArt} alt="" style={{ width: 40, height: 40, opacity: 0.7 }} />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{DEMO_TRACK.title}</div>
              <div style={{ color: "#999", fontSize: 12, marginBottom: 6 }}>{DEMO_TRACK.artist} · {DEMO_TRACK.city}</div>
              <div style={{
                display: "inline-block",
                backgroundColor: "rgba(212,168,67,0.15)",
                border: "1px solid rgba(212,168,67,0.3)",
                color: "#D4A843",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 20,
                letterSpacing: "0.5px",
              }}>
                AI Cover Art + AI Mastered
              </div>
            </div>
          </div>

          {/* Waveform player */}
          <WaveformPlayer audioUrl={DEMO_TRACK.audioUrl} />

          {/* Streaming pills */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 20 }}>
            {["Spotify", "Apple Music", "$ Tip"].map((label) => (
              <div key={label} style={{
                flex: 1, textAlign: "center",
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: "6px 0",
                fontSize: 11, color: "#999",
                cursor: "pointer",
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Merch row */}
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <ShoppingBag size={12} style={{ color: "#D4A843" }} />
              <span style={{ fontSize: 11, color: "#D4A843", fontWeight: 700 }}>$847 earned this month</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {MERCH_ITEMS.map((item) => (
                <div key={item.name} style={{
                  flex: 1,
                  backgroundColor: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: "10px 6px",
                  textAlign: "center",
                  cursor: "pointer",
                }}>
                  <div style={{ fontSize: 11, color: "#ccc", marginBottom: 2, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: "#999" }}>{item.price}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Caption */}
        <p style={{ marginTop: 24, fontSize: 13, color: "#666", lineHeight: 1.7 }}>
          Music. Merch. Tips. Bookings. Fan capture. Analytics. All from{" "}
          <span style={{ color: "#D4A843" }}>one page</span> the artist built in 10 minutes.
        </p>
      </div>
    </section>
  );
}
